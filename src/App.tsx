import { useEffect, useState } from 'react';
import { unlockAudio } from './audio/unlock';
import {
  DEFAULT_PROFILE,
  abandonRaid,
  findActiveRaid,
  getRaid,
  loadBosses,
  loadProfile,
  recordWin,
  saveProfile,
  startRaid,
} from './game/store';
import { BUILT_IN_BOSSES } from './game/bosses';
import type { BossDef, Profile, Raid, Settings } from './game/types';
import { BossSetup } from './ui/BossSetup';
import { Hub } from './ui/Hub';
import { RaidScreen } from './ui/RaidScreen';
import { Victory } from './ui/Victory';

type Screen =
  | { name: 'hub' }
  | { name: 'setup'; boss: BossDef }
  | { name: 'raid'; boss: BossDef; raid: Raid }
  | { name: 'victory'; boss: BossDef; raid: Raid };

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
          onBegin={async (count) => {
            unlockAudio();
            const raid = await startRaid(screen.boss.id, count);
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
          onWin={async (raid) => {
            setProfile(await recordWin(raid));
            setScreen({ name: 'victory', boss: screen.boss, raid });
          }}
        />
      );
    case 'victory':
      return <Victory boss={screen.boss} raid={screen.raid} onDone={goHub} />;
  }
}
