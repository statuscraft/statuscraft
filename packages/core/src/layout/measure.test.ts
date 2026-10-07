import { describe, it, expect } from 'vitest';
import { measureWidget, measureLine, countFlexSeparators } from './measure';
import type { WidgetConfig } from '../types/widget';

describe('measureWidget', () => {
  it('returns zero for null content', () => {
    const widget: WidgetConfig = { id: '1', type: 'model' };
    const result = measureWidget(null, widget);

    expect(result.preferredWidth).toBe(0);
    expect(result.content).toBe('');
  });

  it('returns zero for empty string content', () => {
    const widget: WidgetConfig = { id: '1', type: 'model' };
    const result = measureWidget('', widget);

    expect(result.preferredWidth).toBe(0);
    expect(result.content).toBe('');
    expect(result.truncatable).toBe(false);
  });

  it('measures regular widget content', () => {
    const widget: WidgetConfig = { id: '1', type: 'model' };
    const result = measureWidget('Model: Claude', widget);

    expect(result.preferredWidth).toBe(13);
    expect(result.content).toBe('Model: Claude');
    expect(result.truncatable).toBe(true);
  });

  it('measures separator with default character', () => {
    const widget: WidgetConfig = { id: '1', type: 'separator' };
    const result = measureWidget('|', widget);

    expect(result.preferredWidth).toBe(1);
    expect(result.truncatable).toBe(false);
  });

  it('measures separator with custom character', () => {
    const widget: WidgetConfig = { id: '1', type: 'separator', character: ' | ' };
    const result = measureWidget(' | ', widget);

    expect(result.preferredWidth).toBe(3);
  });

  it('measures flex separator', () => {
    const widget: WidgetConfig = { id: '1', type: 'flex-separator' };
    const result = measureWidget(null, widget);

    expect(result.minWidth).toBe(0);
    expect(result.maxWidth).toBe(Infinity);
    expect(result.truncatable).toBe(false);
  });

  it('respects custom command maxWidth', () => {
    const widget: WidgetConfig = {
      id: '1',
      type: 'custom-command',
      maxWidth: 20,
    };
    const content = 'This is a very long command output';
    const result = measureWidget(content, widget);

    expect(result.preferredWidth).toBe(20);
    expect(result.maxWidth).toBe(20);
  });

  it('does not limit custom command when no maxWidth specified', () => {
    const widget: WidgetConfig = {
      id: '1',
      type: 'custom-command',
    };
    const content = 'This is a very long command output';
    const result = measureWidget(content, widget);

    expect(result.preferredWidth).toBe(content.length);
    expect(result.maxWidth).toBe(content.length);
  });

  it('sets minWidth to MIN_CONTENT_WIDTH for standard widgets', () => {
    const widget: WidgetConfig = { id: '1', type: 'git-branch' };
    const result = measureWidget('main', widget);

    expect(result.minWidth).toBe(20); // LAYOUT.MIN_CONTENT_WIDTH
  });
});

describe('measureLine', () => {
  it('measures all widgets in a line', () => {
    const widgets: WidgetConfig[] = [
      { id: '1', type: 'model' },
      { id: '2', type: 'separator', character: '|' },
      { id: '3', type: 'git-branch' },
    ];
    const contents = ['Model: Claude', '|', 'main'];

    const results = measureLine(widgets, contents);

    expect(results.length).toBe(3);
    expect(results[0]?.preferredWidth).toBe(13);
    expect(results[1]?.preferredWidth).toBe(1);
    expect(results[2]?.preferredWidth).toBe(4);
  });

  it('handles null contents', () => {
    const widgets: WidgetConfig[] = [
      { id: '1', type: 'model' },
      { id: '2', type: 'git-branch' },
    ];
    const contents = ['Model: Claude', null];

    const results = measureLine(widgets, contents);

    expect(results[0]?.preferredWidth).toBe(13);
    expect(results[1]?.preferredWidth).toBe(0);
  });

  it('handles mismatched array lengths', () => {
    const widgets: WidgetConfig[] = [
      { id: '1', type: 'model' },
      { id: '2', type: 'git-branch' },
      { id: '3', type: 'version' },
    ];
    const contents = ['Model: Claude'];

    const results = measureLine(widgets, contents);

    expect(results.length).toBe(3);
    expect(results[0]?.preferredWidth).toBe(13);
    expect(results[1]?.preferredWidth).toBe(0);
    expect(results[2]?.preferredWidth).toBe(0);
  });
});

describe('countFlexSeparators', () => {
  it('counts flex separators', () => {
    const widgets: WidgetConfig[] = [
      { id: '1', type: 'model' },
      { id: '2', type: 'flex-separator' },
      { id: '3', type: 'git-branch' },
      { id: '4', type: 'flex-separator' },
    ];

    expect(countFlexSeparators(widgets)).toBe(2);
  });

  it('returns zero when no flex separators', () => {
    const widgets: WidgetConfig[] = [
      { id: '1', type: 'model' },
      { id: '2', type: 'separator' },
    ];

    expect(countFlexSeparators(widgets)).toBe(0);
  });

  it('returns zero for empty array', () => {
    expect(countFlexSeparators([])).toBe(0);
  });

  it('distinguishes flex-separator from separator', () => {
    const widgets: WidgetConfig[] = [
      { id: '1', type: 'separator' },
      { id: '2', type: 'separator' },
      { id: '3', type: 'flex-separator' },
      { id: '4', type: 'separator' },
    ];

    expect(countFlexSeparators(widgets)).toBe(1);
  });
});
