// POST /api/auth/logout – smaže přihlašovací cookie.
export default defineEventHandler((event) => {
  endSession(event)
  return sendRedirect(event, '/login', 303)
})
