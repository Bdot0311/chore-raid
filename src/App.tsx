import { useEffect, useState } from 'react';
import { unlockAudio } from './audio/unlock';
import { BUILT_IN_BOSSES } from './game/bosses';
import {
  DEFAULT_PROFILE,
  abandonRaid,
  attachPhoto,
  findActiveQuest,
  findActiveRaid,
  finishRaid,
  getRaid,
  loadBosses,
  loadProfile,
  saveCustomBoss,
  saveProfile,
  startQuest,
  startRaid,
} from './game/store';
import type { BossDef, LootItem, Profile, Quest, Raid, RegionId, Settings } from './game/types';
import { savePhoto } from './lib/photos';
import { Armory } from './ui/Armory';
import { BossSetup } from './ui/BossSetup';
import { CustomBossForm } from './ui/CustomBossForm';
import { Hub } from './ui/Hub';
import { QuestRunner } from './ui/QuestRunner';
import { RaidScreen } from './ui/RaidScreen';
import { HeroContext } from './ui/RaidStage';
import { RegionFreed } from './ui/RegionFreed';
import { RegionStart } from './ui/RegionStart';
import { StoryIntro } from './ui/StoryIntro';
import { TownWalk } from './ui/TownWalk';
import { TrophyRoom } from './ui/TrophyRoom';
import { Victory } from './ui/Victory';
import { WorldMap } from './ui/WorldMap';

type Screen =
  | { name: 'intro' }
  | { name: 'map' }
  | { name: 'region'; region: RegionId }
  | { name: 'town'; quest: Quest }
  | { name: 'quest'; quest: Quest }
  | { name: 'freed'; region: RegionId }
  | { name: 'armory' }
  | { name: 'hub' }
  | { name: 'setup'; boss: BossDef }
  | { name: 'raid'; boss: BossDef; raid: Raid }
  | { name: 'victory'; boss: BossDef; raid: Raid; loot: LootItem; freed?: RegionId }
  | { name: 'trophies' }
  | { name: 'summon' };

export default function App() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<Screen>({ name: 'map' });
  const [bosses, setBosses] = useState<BossDef[]>(BUILT_IN_BOSSES);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [activeRaid, setActiveRaid] = useState<Raid>();
  const [activeQuest, setActiveQuest] = useState<Quest>();

  const refresh = async () => {
    const [p, b, a, q] = await Promise.all([loadProfile(), loadBosses(), findActiveRaid(), findActiveQuest()]);
    setProfile(p);
    setBosses(b);
    setActiveRaid(a);
    setActiveQuest(q);
    return p;
  };

  useEffect(() => {
    refresh()
      // Every launch opens on the title and the tale, like a game; returning heroes can skip it.
      .then(() => setScreen({ name: 'intro' }))
      .catch((err) => console.error('Failed to load saved data', err))
      .finally(() => setReady(true));
  }, []);

  const go = async (next: Screen) => {
    setScreen(next);
    await refresh();
  };
  const goMap = () => go({ name: 'map' });
  const goHub = () => go({ name: 'hub' });

  const bossFor = (raid: Raid) => bosses.find((b) => b.id === raid.bossId);

  const saveAndSet = (next: Profile) => {
    setProfile(next);
    void saveProfile(next);
  };
  const updateSettings = (settings: Settings) => saveAndSet({ ...profile, settings });

  if (!ready) return null;

  const view = (() => {
    switch (screen.name) {
      case 'intro':
        return (
          <StoryIntro
            returning={profile.storySeen ? { name: profile.heroName, heroClass: profile.heroClass } : undefined}
            onDone={(heroName, heroClass) => {
              saveAndSet({ ...profile, heroName, heroClass, storySeen: true });
              setScreen({ name: 'map' });
            }}
          />
        );
      case 'map':
        return (
          <WorldMap
            profile={profile}
            activeQuest={activeQuest}
            onRegion={(region) => {
              unlockAudio();
              setScreen({ name: 'region', region });
            }}
            onContinue={(quest) => {
              unlockAudio();
              setScreen({ name: 'quest', quest });
            }}
            onQuickRaid={goHub}
            onTrophies={() => setScreen({ name: 'trophies' })}
            onArmory={() => setScreen({ name: 'armory' })}
            onStory={() => setScreen({ name: 'intro' })}
          />
        );
      case 'region':
        return (
          <RegionStart
            regionId={screen.region}
            profile={profile}
            onBack={goMap}
            onStart={async (levels, names) => {
              unlockAudio();
              const quest = await startQuest(screen.region, levels, names);
              setActiveQuest(quest);
              setScreen({ name: 'town', quest });
            }}
          />
        );
      case 'town':
        return <TownWalk regionId={screen.quest.region} onDone={() => setScreen({ name: 'quest', quest: screen.quest })} />;
      case 'quest':
        return (
          <QuestRunner
            key={screen.quest.id}
            initial={screen.quest}
            profile={profile}
            onProfile={setProfile}
            onSettings={updateSettings}
            onExit={goMap}
            onBossVictory={async (quest, raid, boss) => {
              const res = await finishRaid(raid, boss);
              setProfile(res.profile);
              setScreen({ name: 'victory', boss, raid: res.raid, loot: res.loot, freed: quest.region });
            }}
          />
        );
      case 'freed':
        return <RegionFreed regionId={screen.region} profile={profile} onDone={goMap} />;
      case 'armory':
        return (
          <Armory
            profile={profile}
            onEquip={(id) => saveAndSet({ ...profile, equippedSkin: id })}
            onHero={(heroClass) => saveAndSet({ ...profile, heroClass })}
            onBack={goMap}
          />
        );
      case 'hub':
        return (
          <Hub
            bosses={bosses}
            profile={profile}
            activeRaid={activeRaid}
            onBack={goMap}
            onRegion={(region) => {
              unlockAudio();
              setScreen({ name: 'region', region });
            }}
            onPick={(boss) => setScreen({ name: 'setup', boss })}
            onTrophies={() => setScreen({ name: 'trophies' })}
            onSummon={() => setScreen({ name: 'summon' })}
            onResume={async (raid) => {
              unlockAudio();
              // Re-read in case another tab moved it on.
              const fresh = (await getRaid(raid.id)) ?? raid;
              const boss = bossFor(fresh);
              if (boss && fresh.status === 'active') setScreen({ name: 'raid', boss, raid: fresh });
              else await refresh();
            }}
            onAbandon={async (raid) => {
              await abandonRaid(raid);
              await refresh();
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
            weaponId={profile.equippedSkin}
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
            onDone={() => (screen.freed ? go({ name: 'freed', region: screen.freed }) : goHub())}
          />
        );
      case 'trophies':
        return <TrophyRoom bosses={bosses} onBack={goMap} />;
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
  })();

  return <HeroContext.Provider value={profile.heroClass}>{view}</HeroContext.Provider>;
}
