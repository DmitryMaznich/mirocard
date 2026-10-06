// A screen that has its own inner navigation (an editor inside a topic, with unsaved work) can take the system Back button:
// it registers a function that handles the press and returns true when it did (the app then stays on the screen).
let handler = null;
export const setBackInterceptor = (fn) => { handler = fn; };
export const interceptBack = () => (handler ? Boolean(handler()) : false);
