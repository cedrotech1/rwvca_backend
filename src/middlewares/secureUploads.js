const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

/**
 * Serves upload files only to authenticated users (JWT Bearer or ?token= for img tags).
 */
function secureUploads(uploadRoot) {
  const root = path.resolve(uploadRoot);

  return (req, res) => {
    const bearer = req.headers.authorization;
    const queryToken = req.query.token;
    let token = null;

    if (bearer && bearer.startsWith('Bearer ')) {
      token = bearer.split(' ')[1];
    } else if (typeof queryToken === 'string' && queryToken.length > 0) {
      token = queryToken;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const relative = req.path.replace(/^\/+/, '');
    const resolved = path.resolve(path.join(root, relative));

    if (!resolved.startsWith(root + path.sep) && resolved !== root) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    return res.sendFile(resolved);
  };
}

module.exports = { secureUploads };
