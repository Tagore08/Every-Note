import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Dialog } from './Dialog';

describe('Dialog UI Primitive', () => {
  it('exports Dialog component as a valid function', () => {
    expect(typeof Dialog).toBe('function');
  });

  it('renders nothing when isOpen is false', () => {
    const html = renderToString(
      React.createElement(Dialog, {
        isOpen: false,
        onClose: () => {},
        title: 'Hidden Modal',
        children: React.createElement('div', null, 'Hidden Content'),
      })
    );
    expect(html).toBe('');
  });

  it('renders title, content and ARIA dialog markup when isOpen is true', () => {
    const html = renderToString(
      React.createElement(Dialog, {
        isOpen: true,
        onClose: () => {},
        title: 'Test Title',
        description: 'Test Subtitle',
        children: React.createElement('p', null, 'Hello World'),
      })
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Test Title');
    expect(html).toContain('Test Subtitle');
    expect(html).toContain('Hello World');
    expect(html).toContain('aria-label="Close dialog"');
  });
});
