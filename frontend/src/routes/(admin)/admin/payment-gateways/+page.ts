// Disable data preloading for this route since it uses onMount for client-side data loading
export const ssr = true;
export const prerender = false;

// Disable preloading to prevent errors
export const load = async () => {
  return {};
};
