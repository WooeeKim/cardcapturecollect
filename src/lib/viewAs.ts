// Admin "view as" mode: <site>/?viewAs=<user_id> opens the app showing that account's towns and cards,
// read-only (opened from <site>/admin → People, inside an iframe). The signed-in admin's session reads the
// row (admins can read every user_states row, 005_admin_gallery.sql). Nothing is saved anywhere: changes
// only live in memory, analytics stay off, and account actions (log out, delete, 길BTI) do nothing.
export const viewAsId: string | null = (() => {
  try {
    return new URLSearchParams(location.search).get('viewAs')
  } catch {
    return null
  }
})()

// shown inside the admin page: white around the phone instead of the grey desk
if (viewAsId) document.documentElement.classList.add('view-as')
