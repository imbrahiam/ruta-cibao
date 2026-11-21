/**
 * The desk's theme switch, shared by the inline script (server-rendered, runs
 * before paint) and the client store in `admin-theme.ts`. No "use client"
 * here: the layout needs the script as a string, not as a client reference.
 */
export const ADMIN_THEME_KEY = "ruta-admin-theme";
export const ADMIN_THEME_QUERY = "(prefers-color-scheme: dark)";
/** The attribute on `<html>` the desk's tokens switch on. */
export const ADMIN_THEME_ATTRIBUTE = "data-admin-theme";

/**
 * Runs inline before the desk paints, so a viewer who chose dark never sees a
 * white frame first. Mirrors `resolve` in `admin-theme.ts`.
 */
export const ADMIN_THEME_SCRIPT = `try{var p=localStorage.getItem("${ADMIN_THEME_KEY}");var d=p==="dark"||(p!=="light"&&matchMedia("${ADMIN_THEME_QUERY}").matches);document.documentElement.setAttribute("${ADMIN_THEME_ATTRIBUTE}",d?"dark":"light")}catch(e){
// expected: storage blocked; the desk paints light and the store applies the theme on mount
}`;
