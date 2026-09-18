const remarkOptions = require('../services/remarkOptionsService');

function sendError(res, error, fallbackMessage) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      error: { code: error.code || 'ERROR', message: error.message },
    });
  }
  console.error(fallbackMessage, error);
  return res.status(500).json({
    success: false,
    error: { code: 'DATABASE_ERROR', message: fallbackMessage },
  });
}

const listRemarkOptions = async (req, res) => {
  try {
    const data = await remarkOptions.getOptionsForUser(req.user);
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error, 'Failed to load remark options');
  }
};

const listAllRemarkOptions = async (req, res) => {
  try {
    const data = await remarkOptions.listAllOptions();
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error, 'Failed to load remark options');
  }
};

const createRemarkOption = async (req, res) => {
  try {
    const data = await remarkOptions.createOption({
      label: req.body?.label,
      status_effect: req.body?.status_effect,
    });
    res.status(201).json({ success: true, data, message: 'Remark option added' });
  } catch (error) {
    sendError(res, error, 'Failed to add remark option');
  }
};

const updateRemarkOption = async (req, res) => {
  try {
    const data = await remarkOptions.updateOption(req.params.id, {
      label: req.body?.label,
      status_effect: req.body?.status_effect,
    });
    res.json({ success: true, data, message: 'Remark option updated' });
  } catch (error) {
    sendError(res, error, 'Failed to update remark option');
  }
};

const deleteRemarkOption = async (req, res) => {
  try {
    await remarkOptions.deleteOption(req.params.id);
    res.json({ success: true, message: 'Remark option removed' });
  } catch (error) {
    sendError(res, error, 'Failed to remove remark option');
  }
};

const getMemberRemarkOptions = async (req, res) => {
  try {
    const assignedIds = await remarkOptions.getAssignedOptionIds(req.params.id);
    const data = await remarkOptions.getOptionsForMember(req.params.id);
    res.json({
      success: true,
      data,
      assignedIds,
      usesDefault: assignedIds.length === 0,
    });
  } catch (error) {
    sendError(res, error, 'Failed to load member remark options');
  }
};

const updateMemberRemarkOptions = async (req, res) => {
  try {
    const reset = req.body?.reset === true;
    const optionIds = reset ? [] : (req.body?.optionIds ?? req.body?.option_ids);
    const data = await remarkOptions.setMemberOptions(req.params.id, optionIds);
    const assignedIds = await remarkOptions.getAssignedOptionIds(req.params.id);
    res.json({
      success: true,
      data,
      assignedIds,
      usesDefault: assignedIds.length === 0,
      message: assignedIds.length === 0
        ? 'Restored default remark options'
        : 'Remark options updated for this assignee',
    });
  } catch (error) {
    sendError(res, error, 'Failed to update member remark options');
  }
};

module.exports = {
  listRemarkOptions,
  listAllRemarkOptions,
  createRemarkOption,
  updateRemarkOption,
  deleteRemarkOption,
  getMemberRemarkOptions,
  updateMemberRemarkOptions,
};
