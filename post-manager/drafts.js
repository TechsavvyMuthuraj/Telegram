// =============================================================================
// Techie Post Manager - Draft & State Management
// In-flight post creation sessions & persistent draft storage
// =============================================================================

const userSessions = new Map();
const savedDrafts = new Map(); // userId -> array of saved draft objects

/**
 * Get current in-flight draft for user
 */
function getDraft(userId) {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, {
      userId,
      step: 'idle',
      type: 'text',
      title: '',
      body: '',
      media: null,
      buttons: [],
      templateId: null,
      targetChannel: '@techiemuthuraj',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  return userSessions.get(userId);
}

/**
 * Update current draft
 */
function updateDraft(userId, updates) {
  const current = getDraft(userId);
  const updated = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  userSessions.set(userId, updated);
  return updated;
}

/**
 * Clear in-flight draft
 */
function clearDraft(userId) {
  userSessions.delete(userId);
}

/**
 * Save current draft to user's saved drafts list
 */
function saveDraftPermanently(userId) {
  const draft = getDraft(userId);
  if (!savedDrafts.has(userId)) {
    savedDrafts.set(userId, []);
  }
  const userList = savedDrafts.get(userId);
  const id = `draft_${Date.now()}`;
  const saved = {
    ...draft,
    id,
    savedAt: new Date().toISOString()
  };
  userList.unshift(saved);
  if (userList.length > 20) userList.pop();
  return saved;
}

/**
 * Get all saved drafts for a user
 */
function getSavedDrafts(userId) {
  return savedDrafts.get(userId) || [];
}

/**
 * Delete a specific saved draft
 */
function deleteSavedDraft(userId, draftId) {
  if (!savedDrafts.has(userId)) return false;
  const list = savedDrafts.get(userId);
  const filtered = list.filter(d => d.id !== draftId);
  savedDrafts.set(userId, filtered);
  return true;
}

module.exports = {
  getDraft,
  updateDraft,
  clearDraft,
  saveDraftPermanently,
  getSavedDrafts,
  deleteSavedDraft
};
