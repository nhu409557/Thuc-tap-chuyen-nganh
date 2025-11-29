// assets/js/utils/url.js

export function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}
