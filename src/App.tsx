import { useEffect, useState } from 'react';
import { unlockAudio } from './audio/unlock';
import {
  DEFAULT_PROFILE,
  abandonRaid,
  findActiveRaid,
  getRaid,
  loadBosses,
  loadProfile,
  attachPhoto,
  finishRaid,
  saveCustomBoss,
  saveProfile,
  startRaid,
} from './game/store';
import { BUILT_IN_BOSSES } from './game/bosses';
import type { BossDef, LootItem, Profile, Raid, Settings } from './game/types';
import { savePhoto } from './lib/photos';
import { BossSetup } from './ui/BossSetup';
import { CustomBossForm } from './ui/CustomBossForm';
import { Hub } from './ui/Hub';
import { RaidScreen } from './ui/RaidScreen';
import { TrophyRoom } from './ui/TrophyRoom';
import { Victory } from './ui/Victory';

type Screen =
  | { name: 'hub' }
  | { name: 'setup'; boss: BossDef }
  | { name: 'raid'; boss: BossDef; raid: Raid }
  | { name: 'victory'; boss: BossDef; raid: Raid; loot: LootItem }
  | { name: 'trophies' }
  | { name: 'summon' };

export default function App() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<Screen>({ name: 'hub' });
  const [bosses, setBosses] = useState<BossDef[]>(BUILT_IN_BOSSES);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [activeRaid, setActiveRaid] = useState<Raid>();

  const refreshHub = async () => {
    const [p, b, a] = await Promise.all([loadProfile(), loadBosses(), findActiveRaid()]);
    setProfile(p);
    setBosses(b);
    setActiveRaid(a);
  };

  useEffect(() => {
    refreshHub()
      .catch((err) => console.error('Failed to load saved data', err))
      .finally(() => setReady(true));
  }, []);

  const goHub = async () => {
    setScreen({ name: 'hub' });
    await refreshHub();
  };

  const bossFor = (raid: Raid) => bosses.find((b) => b.id === raid.bossId);

  const updateSettings = (settings: Settings) => {
    const next = { ...profile, settings };
    setProfile(next);
    void saveProfile(next);
  };

  if (!ready) return null;

  switch (screen.name) {
    case 'hub':
      return (
        <Hub
          bosses={bosses}
          profile={profile}
          activeRaid={activeRaid}
          onPick={(boss) => setScreen({ name: 'setup', boss })}
          onTrophies={() => setScreen({ name: 'trophies' })}
          onSummon={() => setScreen({ name: 'summon' })}
          onResume={async (raid) => {
            unlockAudio();
            // Re-read in case another tab moved it on.
            const fresh = (await getRaid(raid.id)) ?? raid;
            const boss = bossFor(fresh);
            if (boss && fresh.status === 'active') setScreen({ name: 'raid', boss, raid: fresh });
            else await refreshHub();
          }}
          onAbandon={async (raid) => {
            await abandonRaid(raid);
            await refreshHub();
          }}
        />
      );
    case 'setup':
      return (
        <BossSetup
          boss={screen.boss}
          settings={profile.settings}
          onSettings={updateSettings}
          onBack={goHub}
          onBegin={async (count, beforePhoto) => {
            unlockAudio();
            let raid = await startRaid(screen.boss.id, count);
            if (beforePhoto) {
              try {
                const photo = await savePhoto(beforePhoto, raid.id);
                raid = (await attachPhoto(raid.id, 'beforePhotoId', photo.id)) ?? raid;
              } catch (err) {
                console.warn('Before photo could not be saved', err);
              }
            }
            setScreen({ name: 'raid', boss: screen.boss, raid });
          }}
        />
      );
    case 'raid':
      return (
        <RaidScreen
          key={screen.raid.id}
          boss={screen.boss}
          initial={screen.raid}
          settings={profile.settings}
          onSettings={updateSettings}
          onLeave={goHub}
          onWin={async (won) => {
            const { raid, loot, profile: p } = await finishRaid(won, screen.boss);
            setProfile(p);
            setScreen({ name: 'victory', boss: screen.boss, raid, loot });
          }}
        />
      );
    case 'victory':
      return (
        <Victory
          boss={screen.boss}
          raid={screen.raid}
          loot={screen.loot}
          onAfterPhoto={async (file) => {
            const photo = await savePhoto(file, screen.raid.id);
            return (await attachPhoto(screen.raid.id, 'afterPhotoId', photo.id)) ?? screen.raid;
          }}
          onDone={goHub}
        />
      );
    case 'trophies':
      return <TrophyRoom bosses={bosses} onBack={goHub} />;
    case 'summon':
      return (
        <CustomBossForm
          onBack={goHub}
          onCreate={async (boss) => {
            await saveCustomBoss(boss);
            setBosses((b) => [...b, boss]);
            setScreen({ name: 'setup', boss });
          }}
        />
      );
  }
}
