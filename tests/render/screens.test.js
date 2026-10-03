// tests/render/screens.test.js — 新屏布局常量与命中检测（纯数据，无 canvas）
// shop/revive 命中用例随 Task 6/7 在各自文件创建后并入
import { it, expect } from 'vitest';
import { SIGNIN_LAYOUT, hitSignin } from '../../src/render/signin.js';
import { defaultSave } from '../../src/meta/save.js';

it('signin 命中：返回/领取（未领可领）', () => {
  const B = SIGNIN_LAYOUT.backBtn, C = SIGNIN_LAYOUT.claimBtn;
  expect(hitSignin(B.x + 5, B.y + 5)).toEqual({ action: 'back' });
  expect(hitSignin(C.x + 5, C.y + 5)).toEqual({ action: 'claim' });
});
it('signin 命中：当日已领时 claim 返回 null', () => {
  const save = defaultSave();
  save.daily.signinClaimedDate = '2026-10-03';
  const C = SIGNIN_LAYOUT.claimBtn;
  expect(hitSignin(C.x + 5, C.y + 5, save)).toBeNull();
});
