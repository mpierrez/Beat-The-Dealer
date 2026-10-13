/**
 * Everything the React screens show. The game engine (engine/game.ts) writes here;
 * components only read it (and call engine functions on input).
 */
import { create } from 'zustand';

export type Screen = 'title' | 'menu' | 'how' | 'results' | null;


export interface UIState {
  screen: Screen;
  // in game
  ctrl: boolean; pauseBtn: boolean; paused: boolean; pauseNote: string;
  mA: string; mB: string; mC: string; mAfx: string;
  sL: string; sB: string; bL: string; bB: string; disabled: boolean;
  // title
  oneUp: string; hiScore: string; credit: string;
  // menu
  menuIdx: number; slide: number;
  // how to
  howThenPlay: boolean;
  // results
  rMode: string; rScore: string; rGrade: string; rGradeColor: string; rQuip: string; rStats: [string, string][]; rBits: number[]; rNew: boolean;
}

export const useUI = create<UIState>(() => ({
  screen: 'title',
  ctrl: false, pauseBtn: false, paused: false, pauseNote: '',
  mA: '', mB: '', mC: '', mAfx: '',
  sL: '', sB: '', bL: 'btn live', bB: 'btn blank', disabled: false,
  oneUp: '1UP 000000', hiScore: '000000', credit: '00',
  menuIdx: 0, slide: 0,
  howThenPlay: false,
  rMode: '', rScore: '', rGrade: '', rGradeColor: '', rQuip: '', rStats: [], rBits: [], rNew: false,
}));
export const ui = (patch: Partial<UIState>) => useUI.setState(patch);
