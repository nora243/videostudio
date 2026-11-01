const fs = require('node:fs');
const path = require('node:path');

function normalize(s) {
  return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Navigate to the project's character tab or read characters from the current page.
 */
async function ensureCharactersTab(page) {
  try { await page.bringToFront(); } catch {}
  const currentUrl = page.url();
  if (currentUrl.includes('/character/') && !currentUrl.endsWith('/character')) {
    // We are inside character editor; click back
    const backBtn = await page.$('.back-button');
    if (backBtn) {
      await backBtn.click();
      await page.waitForTimeout(1500);
    }
  }

  // Click the "Nhân vật" list item on the sidebar if not already selected
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, .mat-mdc-list-item'));
    const charBtn = btns.find(b => {
      const t = (b.innerText || '').trim();
      return (t.includes('Nhân vật') || t.includes('Characters')) && b.classList.contains('mat-mdc-list-item');
    });
    if (charBtn && !charBtn.classList.contains('mdc-list-item--activated')) {
      charBtn.click();
    }
  });
  await page.waitForTimeout(1200);
}

/**
 * List all characters currently defined in the active Flow project.
 * Returns Array<{ index, name, thumbnailSrc, id? }>
 */
async function listProjectCharacters(page) {
  await ensureCharactersTab(page);

  const characters = await page.evaluate(() => {
    const getVisibleText = el => (el.innerText || el.textContent || '').trim();
    const tiles = Array.from(document.querySelectorAll('flow-character-tile'));
    return tiles.map((tile, index) => {
      const nameEl = tile.querySelector('.character-tile-name');
      const img = tile.querySelector('img');
      const rawName = nameEl ? getVisibleText(nameEl) : getVisibleText(tile).split('\n')[0];
      return {
        index,
        name: rawName,
        thumbnailSrc: img ? img.src : null
      };
    });
  });

  return characters;
}

/**
 * Read detailed info for a specific character by opening its editor,
 * inspecting voice and personality description, then navigating back.
 */
async function getCharacterDetails(page, characterIndex = 0) {
  await ensureCharactersTab(page);

  const tiles = await page.$$('flow-character-tile');
  if (!tiles[characterIndex]) return null;

  await tiles[characterIndex].click();
  await page.waitForTimeout(1500);

  const details = await page.evaluate(() => {
    const getVisibleText = el => (el.innerText || el.textContent || '').trim();
    const voiceNameEl = document.querySelector('.voice-card-name');
    const voiceDescEl = document.querySelector('.voice-card-description');
    const descInput = document.querySelector('textarea[aria-label="Tính cách của nhân vật"]');
    const nameInput = document.querySelector('input[aria-label="Tên nhân vật"], input[aria-label="Văn bản có thể chỉnh sửa"]');

    return {
      url: window.location.href,
      name: nameInput ? nameInput.value : '',
      voice: voiceNameEl ? getVisibleText(voiceNameEl) : null,
      voiceDescription: voiceDescEl ? getVisibleText(voiceDescEl) : null,
      description: descInput ? descInput.value : ''
    };
  });

  // Navigate back to project page
  const backBtn = await page.$('.back-button');
  if (backBtn) {
    await backBtn.click();
    await page.waitForTimeout(1000);
  }

  return details;
}

/**
 * Check whether the active Flow project has the expected characters/speakers.
 * Matches by speaker id or speaker name.
 */
async function checkFlowCharacters(page, expectedSpeakers = []) {
  const existingChars = await listProjectCharacters(page);

  const results = expectedSpeakers.map(speaker => {
    const idNorm = normalize(speaker.id);
    const nameNorm = normalize(speaker.name);

    // Find match by id or name
    const match = existingChars.find(c => {
      const cNorm = normalize(c.name);
      return cNorm === idNorm || cNorm === nameNorm;
    });

    return {
      id: speaker.id,
      name: speaker.name,
      expectedVoice: speaker.flowVoice || null,
      description: speaker.description || '',
      imagePath: speaker.imagePath || '',
      exists: !!match,
      flowName: match ? match.name : null,
      thumbnailSrc: match ? match.thumbnailSrc : null
    };
  });

  const allSynced = results.length > 0 && results.every(r => r.exists);
  return {
    characters: results,
    totalExpected: expectedSpeakers.length,
    totalExisting: existingChars.length,
    allSynced
  };
}

/**
 * Create a new character in Flow by uploading an image, setting name,
 * description, and selecting an assigned Flow voice.
 */
async function createFlowCharacter(page, { name, voice, description, imagePath }, report = () => {}) {
  if (!imagePath || !fs.existsSync(imagePath)) {
    throw new Error(`Không tìm thấy file ảnh tham chiếu: ${imagePath}`);
  }

  report('flow.character.nav', `Mở trang tạo nhân vật cho "${name}"`);
  const baseUrl = page.url().replace(/\/character.*$/, '');
  await page.goto(baseUrl + '/character', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  report('flow.character.upload', `Tải ảnh tham chiếu nhân vật: ${path.basename(imagePath)}`);
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 15000 }),
    page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const uploadBtn = btns.find(b => {
        const t = (b.innerText || '').trim();
        return (t.includes('Tải lên') || t.includes('Upload')) && !b.disabled;
      });
      if (uploadBtn) uploadBtn.click();
    })
  ]);

  await fileChooser.setFiles(imagePath);

  report('flow.character.processing', `Flow đang phân tích góc nhìn và tạo nhân vật...`);
  await page.waitForURL(url => url.pathname.includes('/character/') && !url.pathname.endsWith('/character'), { timeout: 45000 });
  await page.waitForTimeout(3000);

  // Set character name
  report('flow.character.name', `Đặt tên nhân vật: ${name}`);
  const pencilBtn = await page.$('.pencil-button');
  if (pencilBtn) {
    await pencilBtn.click();
    await page.waitForTimeout(400);
  }
  const nameInput = await page.$('input[aria-label="Tên nhân vật"], input[aria-label="Văn bản có thể chỉnh sửa"]');
  if (nameInput) {
    await nameInput.fill(name);
    await nameInput.press('Enter');
    await page.waitForTimeout(400);
  }

  // Set description
  if (description) {
    report('flow.character.desc', `Điền mô tả tính cách cho ${name}`);
    const descTextarea = await page.$('textarea[aria-label="Tính cách của nhân vật"]');
    if (descTextarea) {
      await descTextarea.fill(description);
      await page.waitForTimeout(400);
    }
  }

  // Set voice if specified
  if (voice) {
    report('flow.character.voice', `Gán giọng nói ${voice} cho ${name}`);
    const voiceBtn = await page.$('.voice-selector-empty-btn');
    if (voiceBtn) {
      await voiceBtn.click();
      await page.waitForTimeout(1500);

      // Search voice name
      const searchInput = await page.$('input[placeholder*="thành phần"], input[placeholder*="ingredient"]');
      if (searchInput) {
        await searchInput.fill(voice);
        await page.waitForTimeout(1000);
      }

      // Click matching voice item
      const clicked = await page.evaluate((targetVoice) => {
        const normTarget = targetVoice.trim().toLowerCase();
        const items = Array.from(document.querySelectorAll('.asset-item'));
        const item = items.find(el => (el.innerText || '').toLowerCase().includes(normTarget));
        if (item) {
          item.click();
          return true;
        }
        return false;
      }, voice);

      if (clicked) {
        await page.waitForTimeout(800);
        // Click "Thêm vào nhân vật"
        const addVoiceBtn = await page.$('.detail-add-to-prompt-btn');
        if (addVoiceBtn) {
          await addVoiceBtn.click();
          await page.waitForTimeout(1200);
        }
      } else {
        // Close modal if voice not found
        const closeBtn = await page.$('mat-dialog-container button.header-close-btn');
        if (closeBtn) await closeBtn.click();
      }
    }
  }

  // Save character with "Xong"
  report('flow.character.save', `Lưu nhân vật ${name} lên Flow`);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const doneBtn = btns.find(b => (b.innerText || '').trim() === 'Xong' || (b.innerText || '').trim() === 'Done');
    if (doneBtn) doneBtn.click();
  });

  await page.waitForTimeout(3000);
  report('flow.character.done', `Đã tạo thành công nhân vật ${name} trên Flow!`);
  return { ok: true, name, voice };
}

/**
 * Synchronize all missing characters up to Flow.
 */
async function syncFlowCharacters(page, speakers = [], options = {}, report = () => {}) {
  const status = await checkFlowCharacters(page, speakers);
  const missing = status.characters.filter(c => !c.exists);

  if (!missing.length) {
    report('flow.character.synced', 'Tất cả nhân vật đã có trên Flow.');
    return { ok: true, created: 0, status };
  }

  const defaultImage = options.imagePath;
  let createdCount = 0;
  const errors = [];

  for (const char of missing) {
    report('flow.character.start', `Bắt đầu tạo nhân vật ${char.name} (${char.id})...`);
    const charImage = char.imagePath || defaultImage;
    if (!charImage || !fs.existsSync(charImage)) {
      report('flow.character.error', `Không có ảnh tham chiếu cho ${char.name}, bỏ qua.`);
      errors.push({id:char.id,message:'Chưa chọn ảnh hoặc ảnh không tồn tại.'});
      continue;
    }

    try {
      await createFlowCharacter(page, {
        name: char.id, // Use speaker id so Flow matches prompts cleanly
        voice: char.expectedVoice,
        description: char.description,
        imagePath: charImage
      }, report);
      createdCount++;
    } catch (err) {
      errors.push({id:char.id,message:err.message});
      report('flow.character.error', `Lỗi khi tạo nhân vật ${char.name}: ${err.message}`);
    }
  }

  // Refresh status
  const finalStatus = await checkFlowCharacters(page, speakers);
  return {
    ok: true,
    created: createdCount,
    errors,
    status: finalStatus
  };
}

module.exports = {
  normalize,
  ensureCharactersTab,
  listProjectCharacters,
  getCharacterDetails,
  checkFlowCharacters,
  createFlowCharacter,
  syncFlowCharacters
};
