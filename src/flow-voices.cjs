const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function normalize(s) {
  return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Default sample dialogues for cat-family characters if not provided.
 */
const DEFAULT_SAMPLE_DIALOGUES = {
  bo_bu: 'Cái thằng Tí Hổ kia! Mày lại trêu em để nó khóc lóc om sòm cả làng lên thế hả?',
  me_muop: 'Hai bố con lại bày trò gì đấy? Mau dọn dẹp sạch sẽ rồi vào ăn cơm ngay!',
  ti_ho: 'Bố bớt giận! Con vừa tậu hẳn hai con cá nục một nắng đặc biệt biếu bố.',
  chi_na: 'Mẹ ơi xem anh Tí Hổ kìa, lại tranh tivi không cho ai xem hết á!',
  ut_ngao: 'Bố ơi anh Tí Hổ bắt nạt con, lấy mất con cá khô của con rồi hu hu...'
};

/**
 * Default authentic Northern Vietnamese performance descriptions.
 */
const DEFAULT_PERFORMANCE_DESCRIPTIONS = {
  bo_bu: 'Authentic native Northern Vietnamese accent (thuần âm điệu Bắc Bộ, phát âm chuẩn thanh điệu tiếng Việt, không lai Tây); Giọng nam vai bố trưởng thành, người bản xứ Việt Nam, trầm ấm, nhịp chậm vừa, thích ra vẻ nghiêm nghị; khi sợ vợ chỉ hạ âm lượng và ngập ngừng, giữ nguyên âm sắc. Không giọng trẻ 5 tuổi.',
  me_muop: 'Authentic native Northern Vietnamese accent (thuần âm điệu Bắc Bộ, phát âm chuẩn thanh điệu tiếng Việt, không lai Tây); Giọng nữ vai mẹ trưởng thành, người bản xứ Việt Nam, trung âm rõ, chắc gọn, bình tĩnh và quyết đoán, không lai âm Tây, không the thé. Một giọng cố định, khác rõ Chị Na.',
  ti_ho: 'Authentic native Northern Vietnamese accent (thuần âm điệu Bắc Bộ, phát âm chuẩn thanh điệu tiếng Việt, không lai Tây); Giọng nam thiếu niên lanh lợi, trung cao, hơi nghênh, nói nhanh vừa, khi chối lỗi hơi lắp bắp; không đổi tông hay bản sắc. Khác giọng trầm Bố Bự và giọng non Út Ngáo.',
  chi_na: 'Authentic native Northern Vietnamese accent (thuần âm điệu Bắc Bộ, phát âm chuẩn thanh điệu tiếng Việt, không lai Tây); Giọng nữ trẻ trong, người bản xứ Việt Nam, hơi cao, điệu đà tự nhiên, phát âm tròn tiếng chuẩn tiếng Việt miền Bắc, không lai âm Tây; nhịp líu lo vừa.',
  ut_ngao: 'Authentic native Northern Vietnamese accent (thuần âm điệu Bắc Bộ, phát âm chuẩn thanh điệu tiếng Việt, không lai Tây); Giọng bé trai non, cao mềm, ngây thơ, phát âm tiếng Việt tròn tiếng, câu ngắn ngập ngừng tự nhiên. Giữ một bản sắc giọng.'
};

/**
 * Base preset voices for cat-family characters.
 */
const DEFAULT_BASE_VOICES = {
  bo_bu: 'Charon',
  me_muop: 'Aoede',
  ti_ho: 'Orus',
  chi_na: 'Autonoe',
  ut_ngao: 'Fenrir'
};

/**
 * Open the Add Menu ingredients overlay and select the "Giọng nói" category tab.
 */
async function openVoicesPanel(page) {
  if (!await page.locator('.asset-list-viewport').isVisible()) {
    const addBtn = page.getByRole('button', { name: /^(Thêm thành phần vào ô nhập câu lệnh|Add ingredients to prompt)$/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await sleep(400);
    }
  }

  const voiceTab = page.getByRole('tablist', { name: /^(Di chuyển theo danh mục|Navigate by category)$/i }).getByText(/^(Giọng nói|Voices)$/i);
  if (await voiceTab.isVisible()) {
    await voiceTab.click();
    await sleep(400);
  }
}

/**
 * Close any open overlays or dialogs.
 */
async function closeOverlays(page) {
  for (let i = 0; i < 3; i++) await page.keyboard.press('Escape');
  await sleep(150);
  const backdrop = page.locator('.cdk-overlay-backdrop.cdk-overlay-backdrop-showing');
  if (await backdrop.first().isVisible()) {
    try {
      await backdrop.first().click({ position: { x: 2, y: 2 }, timeout: 2000 });
    } catch {}
  }
}

/**
 * Quick retrieval of all custom voice names saved on Flow.
 * Custom voices are always listed at the top before standard preset voices.
 */
async function getCustomVoiceNames(page) {
  try {
    await openVoicesPanel(page);
    const names = new Set();
    const vp = page.locator('.asset-list-viewport');
    if (!await vp.isVisible()) return [];

    // Reset scroll to top
    await page.evaluate(() => {
      const v = document.querySelector('.asset-list-viewport');
      if (v) {
        v.scrollTop = 0;
        v.dispatchEvent(new Event('scroll'));
      }
    });
    await sleep(150);

    for (let top = 0; top <= 1200; top += 150) {
      const { items, hasStandard } = await page.evaluate(() => {
        const v = document.querySelector('.asset-list-viewport');
        if (!v) return { items: [], hasStandard: false };
        const rendered = Array.from(v.querySelectorAll('.asset-item'));
        const customItems = [];
        let standardFound = false;
        for (const item of rendered) {
          const isCustom = item.innerHTML.includes('settings_2') || 
                           !!item.querySelector('.settings-icon') || 
                           !!item.querySelector('.custom-voice-badge') ||
                           !!item.querySelector('button.delete-button');
          const title = item.querySelector('.asset-title')?.innerText?.trim() || item.innerText?.trim();
          if (isCustom && title) customItems.push(title);
          else if (!isCustom && title) standardFound = true;
        }
        return { items: customItems, hasStandard: standardFound };
      });

      for (const it of items) names.add(it);
      if (hasStandard) break; // Standard preset voices reached, all custom voices collected!

      await page.evaluate((newTop) => {
        const v = document.querySelector('.asset-list-viewport');
        if (v) {
          v.scrollTop = newTop;
          v.dispatchEvent(new Event('scroll'));
        }
      }, top);
      await sleep(100);
    }
    return [...names];
  } catch {
    return [];
  }
}

/**
 * Matches a speaker object against custom voice names saved on Flow.
 */
function matchSpeakerToCustomVoice(speaker, customVoiceNames = []) {
  if (!speaker || !customVoiceNames.length) return null;
  const sName = normalize(speaker.name);
  const sId = normalize(speaker.id).replace(/[_-]/g, ' ');
  const sBase = normalize(speaker.flowVoice);

  for (const c of customVoiceNames) {
    const cNorm = normalize(c);
    // 1. Matches character name (e.g. "bo bu tuy chinh" includes "bo bu")
    if (sName && (cNorm.includes(sName) || sName.includes(cNorm))) return c;
    // 2. Matches character id (e.g. "bo bu tuy chinh" includes "bo bu")
    if (sId && (cNorm.includes(sId) || sId.includes(cNorm))) return c;
    // 3. Matches base voice + tuy chinh (e.g. "sadaltager tuy chinh" includes "sadaltager")
    if (sBase && (cNorm.includes(`${sBase} tuy chinh`) || cNorm.includes(`${sBase} tuỳ chỉnh`))) return c;
  }
  return null;
}

/**
 * Scroll and locate a voice by name in the virtual scroll viewport, then click it.
 */
async function selectVoiceInList(page, voiceName) {
  const normTarget = normalize(voiceName);
  const viewport = page.locator('.asset-list-viewport');
  await viewport.waitFor({ state: 'visible', timeout: 5000 });

  // Reset scroll to top
  await page.evaluate(() => {
    const vp = document.querySelector('.asset-list-viewport');
    if (vp) {
      vp.scrollTop = 0;
      vp.dispatchEvent(new Event('scroll'));
    }
  });
  await sleep(200);

  // Search through virtual scroll positions
  const maxScroll = await page.evaluate(() => {
    const vp = document.querySelector('.asset-list-viewport');
    return vp ? (vp.scrollHeight - vp.clientHeight) : 1000;
  });

  const step = 150;
  for (let top = 0; top <= maxScroll + step; top += step) {
    // Check currently rendered items: first look for exact match, then substring match
    const foundIndex = await page.evaluate((target) => {
      const norm = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const vp = document.querySelector('.asset-list-viewport');
      if (!vp) return -1;
      const items = Array.from(vp.querySelectorAll('.asset-item'));
      
      // 1. Exact match
      let idx = items.findIndex(item => {
        const title = item.querySelector('.asset-title')?.innerText || item.innerText || '';
        return norm(title) === target;
      });
      if (idx >= 0) return idx;

      return -1;
    }, normTarget);

    if (foundIndex >= 0) {
      const items = viewport.locator('.asset-item');
      await items.nth(foundIndex).click();
      await sleep(300);
      return true;
    }

    // Scroll down
    await page.evaluate((newTop) => {
      const vp = document.querySelector('.asset-list-viewport');
      if (vp) {
        vp.scrollTop = newTop;
        vp.dispatchEvent(new Event('scroll'));
      }
    }, top);
    await sleep(120);
  }

  return false;
}

/**
 * List all voices available in the active Flow project,
 * distinguishing standard preset voices from saved custom voices.
 */
async function listFlowVoices(page) {
  await openVoicesPanel(page);

  const voices = await page.evaluate(async () => {
    const vp = document.querySelector('.asset-list-viewport');
    if (!vp) return { standard: [], custom: [] };

    const seen = new Map();
    const maxScroll = vp.scrollHeight - vp.clientHeight;
    const step = 200;

    for (let top = 0; top <= maxScroll + step; top += step) {
      vp.scrollTop = top;
      vp.dispatchEvent(new Event('scroll'));
      await new Promise(r => setTimeout(r, 60));

      const items = Array.from(vp.querySelectorAll('.asset-item'));
      for (const item of items) {
        const title = item.querySelector('.asset-title')?.innerText?.trim() || '';
        const desc = item.querySelector('.asset-description')?.innerText?.trim() || '';
        const isCustom = item.innerHTML.includes('settings_2') || 
                         !!item.querySelector('.settings-icon') || 
                         !!item.querySelector('button.delete-button');

        if (title && !seen.has(title)) {
          seen.set(title, {
            name: title,
            description: desc,
            isCustom
          });
        }
      }
    }

    const all = Array.from(seen.values());
    return {
      standard: all.filter(v => !v.isCustom),
      custom: all.filter(v => v.isCustom)
    };
  });

  return voices;
}

/**
 * Automate creating a new custom voice in Google Flow.
 */
async function createFlowCustomVoice(page, { baseVoice, sampleDialogue, description, name, attachToPrompt = false }, report = () => {}) {
  if (!name?.trim()) throw new Error('Cần đặt tên cho giọng nói tùy chỉnh.');
  if (!baseVoice?.trim()) throw new Error('Cần chọn giọng gốc (base voice) cho giọng tùy chỉnh.');

  report('flow.voice.create.start', `Bắt đầu tạo giọng tùy chỉnh "${name}" (gốc: ${baseVoice})...`);
  await openVoicesPanel(page);

  report('flow.voice.create.base', `Chọn giọng gốc "${baseVoice}" trên Flow...`);
  const found = await selectVoiceInList(page, baseVoice);
  if (!found) {
    throw new Error(`Không tìm thấy giọng gốc "${baseVoice}" trong danh sách Flow.`);
  }

  report('flow.voice.create.form', `Điền đặc điểm giọng và hội thoại mẫu cho "${name}"...`);

  // 1. Fill voice characteristics description (Tuỳ chỉnh đặc điểm giọng nói) first
  // to trigger Flow revealing the voice name input and save button
  const descInput = page.locator('textarea.performance-input');
  await descInput.waitFor({ state: 'visible', timeout: 5000 });
  await descInput.fill(description || '');
  await sleep(250);

  // 2. Fill sample dialogue (Hội thoại mẫu, max 120 chars)
  const sampleInput = page.locator('textarea.sample-dialogue-input');
  if (await sampleInput.isVisible() && sampleDialogue) {
    const trimmedSample = String(sampleDialogue).trim().slice(0, 120);
    await sampleInput.fill(trimmedSample);
    await sleep(150);
  }

  // 3. Fill voice name (Tên giọng nói)
  const nameInput = page.locator('input.voice-name-input');
  await nameInput.waitFor({ state: 'visible', timeout: 5000 });
  await nameInput.fill(name);
  await sleep(150);

  // 4. Click "Lưu giọng nói mới"
  report('flow.voice.create.save', `Lưu giọng nói mới "${name}" lên Flow...`);
  const saveBtn = page.locator('button.voice-save-button');
  await saveBtn.waitFor({ state: 'visible', timeout: 5000 });
  await saveBtn.click();

  // 5. Wait for save operation to finish (Thêm vào câu lệnh button appears)
  const addBtn = page.locator('button.detail-add-to-prompt-btn');
  await addBtn.waitFor({ state: 'visible', timeout: 30000 });

  if (attachToPrompt) {
    report('flow.voice.create.attach', `Gắn chip giọng "${name}" vào prompt Flow...`);
    await addBtn.click();
    await sleep(300);
  }

  report('flow.voice.create.done', `Đã tạo thành công giọng tùy chỉnh "${name}" trên Flow!`);
  return { ok: true, name, baseVoice };
}

/**
 * Check which speakers have custom voices saved on Flow.
 */
async function checkProjectCustomVoices(page, speakers = []) {
  const { custom, standard } = await listFlowVoices(page);

  const results = speakers.map(s => {
    const sId = normalize(s.id);
    const sName = normalize(s.name);
    const base = s.flowVoice || DEFAULT_BASE_VOICES[s.id] || 'Orus';
    const baseNorm = normalize(base);

    // Look for a custom voice matching speaker id, speaker name, or base voice + "tuy chinh"
    const match = custom.find(c => {
      const cNorm = normalize(c.name);
      return cNorm === sId || 
             cNorm === sName || 
             cNorm.includes(sName) || 
             cNorm === `${baseNorm} tuy chinh` ||
             cNorm.includes(`${sName} tuy chinh`);
    });

    return {
      id: s.id,
      name: s.name,
      baseVoice: base,
      customVoiceName: match ? match.name : `${s.name} tuỳ chỉnh`,
      exists: !!match,
      matchedCustomVoice: match ? match.name : null,
      description: s.description || DEFAULT_PERFORMANCE_DESCRIPTIONS[s.id] || ''
    };
  });

  const allSynced = results.length > 0 && results.every(r => r.exists);
  return {
    voices: results,
    customVoicesOnFlow: custom.map(c => c.name),
    totalExpected: speakers.length,
    totalExisting: results.filter(r => r.exists).length,
    allSynced
  };
}

/**
 * Synchronize custom voices for all project characters onto Flow.
 */
async function syncProjectCustomVoices(page, speakers = [], options = {}, report = () => {}) {
  const status = await checkProjectCustomVoices(page, speakers);
  const missing = status.voices.filter(v => !v.exists);

  if (!missing.length) {
    report('flow.voice.synced', 'Tất cả nhân vật đã có giọng tùy chỉnh trên Flow.');
    await closeOverlays(page);
    return { ok: true, created: 0, status };
  }

  let createdCount = 0;
  const errors = [];

  for (const item of missing) {
    report('flow.voice.sync.item', `Đang tạo giọng tùy chỉnh cho ${item.name} (${item.id})...`);
    
    const sampleDialogue = options.sampleDialogues?.[item.id] || DEFAULT_SAMPLE_DIALOGUES[item.id] || `Tôi là ${item.name}, xin chào mọi người.`;
    const description = options.descriptions?.[item.id] || item.description || DEFAULT_PERFORMANCE_DESCRIPTIONS[item.id] || '';
    const voiceName = options.names?.[item.id] || `${item.name} tuỳ chỉnh`;

    try {
      await createFlowCustomVoice(page, {
        baseVoice: item.baseVoice,
        sampleDialogue,
        description,
        name: voiceName
      }, report);
      createdCount++;
    } catch (err) {
      errors.push({ id: item.id, message: err.message });
      report('flow.voice.error', `Lỗi khi tạo giọng cho ${item.name}: ${err.message}`);
    }
  }

  await closeOverlays(page);
  const finalStatus = await checkProjectCustomVoices(page, speakers);
  await closeOverlays(page);

  return {
    ok: true,
    created: createdCount,
    errors,
    status: finalStatus
  };
}

module.exports = {
  normalize,
  openVoicesPanel,
  closeOverlays,
  getCustomVoiceNames,
  matchSpeakerToCustomVoice,
  selectVoiceInList,
  listFlowVoices,
  createFlowCustomVoice,
  checkProjectCustomVoices,
  syncProjectCustomVoices,
  DEFAULT_SAMPLE_DIALOGUES,
  DEFAULT_PERFORMANCE_DESCRIPTIONS,
  DEFAULT_BASE_VOICES
};
