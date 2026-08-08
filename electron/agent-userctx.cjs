/**
 * Adjunta el texto del usuario a helpers para el gate de permisos 0.2
 */
function withUserContext(helpers, userText) {
  const h = helpers || {};
  h.userText = String(userText || '');
  return h;
}

module.exports = { withUserContext };
