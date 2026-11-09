// A sign-in lasts only while the site is open.
//
// The token lives in sessionStorage, which survives a refresh but is cleared
// when the tab closes. A newly opened tab borrows the token from a tab of the
// site that is still open, so several tabs work together; once the last one
// closes - or the browser does - the next visit asks for the password again.
//
// Browsers that reopen tabs on restart also bring their sessionStorage back,
// and a tab that left the site can come back to it with the Back button. So
// the site notes, while it is open, that it is in use; a token it has not
// used for STALE_MS is dropped.

const TOKEN = "keiyian_token";
const SEEN = "keiyian_seen";
const STALE_MS = 30 * 1000;
const HEARTBEAT_MS = 10 * 1000;
const ASK_MS = 250;

const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel("keiyian-session") : null;

let current = null;
// Signed in here, so this tab may hand its token to a new tab.
let live = false;

const read = (key) => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key, value) => {
  try {
    if (value == null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // Storage blocked: the sign-in lasts until the page is reloaded.
  }
};

const seen = () => write(SEEN, String(Date.now()));
const fresh = () => Date.now() - Number(read(SEEN) || 0) < STALE_MS;
const signedOutHere = () => window.dispatchEvent(new Event("keiyian:unauthorized"));

// Older versions kept the token in localStorage, which outlives the browser.
try {
  localStorage.removeItem(TOKEN);
  localStorage.removeItem("keiyian_user");
} catch {
  // Nothing stored, or storage blocked.
}

/** The token to send with API calls, or null. */
export const getToken = () => current;

/** Keep the token of a sign-in for this tab. */
export const saveToken = (token) => {
  current = token;
  live = true;
  write(TOKEN, token);
  seen();
};

/** Forget the token. `everywhere` also signs out the site's other open tabs. */
export const forgetToken = ({ everywhere = false } = {}) => {
  current = null;
  live = false;
  write(TOKEN, null);
  write(SEEN, null);
  if (everywhere) channel?.postMessage({ type: "signed-out" });
};

/** Ask the site's other open tabs for their token; null when none answers. */
const askOpenTabs = () =>
  new Promise((resolve) => {
    if (!channel) {
      resolve(null);
      return;
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let timer;
    const onMessage = (event) => {
      if (event.data?.type === "token" && event.data.to === id) finish(event.data.token);
    };
    const finish = (token) => {
      clearTimeout(timer);
      channel.removeEventListener("message", onMessage);
      resolve(token);
    };
    timer = setTimeout(() => finish(null), ASK_MS);
    channel.addEventListener("message", onMessage);
    channel.postMessage({ type: "ask", from: id });
  });

/**
 * The token to carry on with when the app starts: this tab's own after a
 * refresh, or one handed over by another open tab. Null means sign in.
 */
export const restoreToken = async () => {
  const own = read(TOKEN);
  if (own && fresh()) {
    saveToken(own);
    return own;
  }
  forgetToken();
  const borrowed = await askOpenTabs();
  if (borrowed) saveToken(borrowed);
  return borrowed;
};

channel?.addEventListener("message", (event) => {
  const message = event.data || {};
  if (message.type === "ask" && live && current) channel.postMessage({ type: "token", to: message.from, token: current });
  if (message.type === "signed-out" && current) {
    forgetToken();
    signedOutHere();
  }
});

// While signed in, note that the site is in use - including just before a
// refresh or leaving the page.
const touch = () => {
  if (live) seen();
};
window.addEventListener("pagehide", touch);
document.addEventListener("visibilitychange", touch);
setInterval(touch, HEARTBEAT_MS);

// Coming back with the Back button can restore the page as it was left; if
// it was left more than STALE_MS ago, the sign-in has ended.
window.addEventListener("pageshow", (event) => {
  if (!event.persisted || !live) return;
  if (fresh()) {
    seen();
    return;
  }
  forgetToken();
  signedOutHere();
});
