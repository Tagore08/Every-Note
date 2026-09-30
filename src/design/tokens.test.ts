import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Design Tokens & CSS Consistency', () => {
  const tokensPath = path.resolve(__dirname, 'tokens.css');
  const tokensContent = fs.readFileSync(tokensPath, 'utf8');

  const themes = ['rose', 'sage', 'lavender', 'champagne', 'ocean', 'peach', 'slate'];

  const requiredTokens = [
    '--color-bg',
    '--color-surface',
    '--color-surface-2',
    '--color-surface-3',
    '--color-border',
    '--color-border-subtle',
    '--color-ink',
    '--color-ink-muted',
    '--color-ink-faint',
    '--color-accent',
    '--color-accent-ink',
    '--color-accent-soft',
    '--color-accent-hover',
    '--color-accent-2',
  ];

  it('defines the --breakpoint-xs in @theme', () => {
    expect(tokensContent).toContain('--breakpoint-xs: 380px;');
  });

  it('defines light mode default tokens in @theme', () => {
    expect(tokensContent).toContain('--color-bg:            oklch(0.978 0.006 75);');
    expect(tokensContent).toContain('--color-ink:           oklch(0.18 0.015 65);');
  });

  it('defines plum dark mode tokens in .dark', () => {
    expect(tokensContent).toContain('--color-bg:            #1B0C1A;');
    expect(tokensContent).toContain('--color-surface:       #241122;');
    expect(tokensContent).toContain('--color-ink:           #FDFBFD;');
  });

  themes.forEach((theme) => {
    it(`defines all 14 core color tokens for light [data-theme="${theme}"]`, () => {
      const themeBlockRegex = new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([^}]+)\\}`, 'm');
      const match = tokensContent.match(themeBlockRegex);
      expect(match, `Block [data-theme="${theme}"] not found`).toBeTruthy();
      const blockContent = match![1];

      requiredTokens.forEach((token) => {
        expect(blockContent, `Token ${token} missing in [data-theme="${theme}"]`).toContain(token);
      });
    });

    it(`defines all 14 core color tokens for dark .dark[data-theme="${theme}"]`, () => {
      const themeBlockRegex = new RegExp(`\\.dark\\[data-theme="${theme}"\\]\\s*\\{([^}]+)\\}`, 'm');
      const match = tokensContent.match(themeBlockRegex);
      expect(match, `Block .dark[data-theme="${theme}"] not found`).toBeTruthy();
      const blockContent = match![1];

      requiredTokens.forEach((token) => {
        expect(blockContent, `Token ${token} missing in .dark[data-theme="${theme}"]`).toContain(token);
      });
    });
  });
});
