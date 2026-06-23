import type { Action } from 'svelte/action';

/**
 * Portal action that moves an element to the document body
 * Useful for modals, tooltips, and other overlays that need to be above all content
 */
export const portal: Action<HTMLElement, string | undefined> = (node, target = 'body') => {
  let targetElement: HTMLElement | null = null;

  function update() {
    if (typeof target === 'string') {
      targetElement = document.querySelector(target);
    } else {
      targetElement = document.body;
    }

    if (targetElement && node.parentNode !== targetElement) {
      targetElement.appendChild(node);
    }
  }

  // Use requestAnimationFrame to ensure DOM is ready
  if (typeof document !== 'undefined') {
    requestAnimationFrame(update);
  }

  return {
    update,
    destroy() {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    },
  };
};
