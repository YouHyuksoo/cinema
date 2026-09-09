import { useJarvisVoice } from './useJarvisVoice';
import type { FilmPlayback } from './useFilmPlayback';
import type { FilmId } from './filmProgram';
import type { MachineSubject } from './machinePresentation';
import { runTurbineCommand, type TurbineCommand } from './turbineCommands';

/** One voice session and explicit command routing for the main page and every film scene. */
export function useFilmTurbine(player: FilmPlayback, home: () => void, close: () => void) {
  const selectScene = (id: FilmId, subject?: MachineSubject) => {
    close();
    if (subject) player.changeMachineSubject(subject);
    player.selectChapter(id);
  };
  const voice = useJarvisVoice(selectScene, { sceneData: () => player.sceneData, applySceneObjects: player.applySceneObjects });
  return { voice, selectScene, command(command: TurbineCommand) {
    runTurbineCommand(command, {
      home,
      briefing() { home(); void voice.ask('현장 요약'); },
      pause() { voice.stop(); player.pause(); },
      play() { voice.stop(); close(); player.play(); },
      conversation() { home(); if (!voice.active) void voice.start(); },
    });
  } };
}
