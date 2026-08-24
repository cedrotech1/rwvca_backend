export const ok = (res, data = null, message = "Success", status = 200) => {
  const payload = { success: true, message };
  if (data !== null && data !== undefined) payload.data = data;
  return res.status(status).json(payload);
};

export const fail = (res, message = "Request failed", status = 400, extra = {}) => {
  return res.status(status).json({ success: false, message, ...extra });
};

export const created = (res, data, message = "Created") => ok(res, data, message, 201);
