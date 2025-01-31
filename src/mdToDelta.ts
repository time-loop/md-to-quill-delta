import Op from 'quill-delta/dist/Op';
import Delta from 'quill-delta';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough';
import { gfmTable } from 'micromark-extension-gfm-table';
import { gfmTaskListItem } from 'micromark-extension-gfm-task-list-item';
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table';
import { gfmStrikethroughFromMarkdown } from 'mdast-util-gfm-strikethrough';
import { gfmTaskListItemFromMarkdown } from 'mdast-util-gfm-task-list-item';
import { Parent } from 'unist';

export interface MarkdownToQuillOptions {
  debug?: boolean;
  lineBreakBlocks?: string[];
  preciseLineBreak?: boolean;
  tableIdGenerator: () => string;
  enableCustomHtmlConverter: boolean;
  customHtmlConverter?: (
    parent: Node | Parent,
    node: Node | Parent,
    op: Op,
    indent,
  ) => Delta | undefined;
}

const defaultOptions: MarkdownToQuillOptions = {
  lineBreakBlocks: [
    'paragraph',
    'code',
    'heading',
    'blockquote',
    'list',
    'table'
  ],
  debug: false,
  preciseLineBreak: false,
  tableIdGenerator: () => {
    const id = Math.random()
      .toString(36)
      .slice(2, 6);
    return `row-${id}`;
  },
  enableCustomHtmlConverter: false,
};

export class MarkdownToQuill {
  options: MarkdownToQuillOptions;

  blocks: string[];

  prevEndLine: number = 1;
  splitAttributes: object | null = null;

  constructor(options?: Partial<MarkdownToQuillOptions>) {
    this.options = {
      ...defaultOptions,
      ...options
    };
    this.blocks = this.options.lineBreakBlocks;
  }

  convert(text: string): Op[] {
    const tree: Parent = fromMarkdown(text, {
      extensions: [gfmStrikethrough(), gfmTable(), gfmTaskListItem()],
      mdastExtensions: [gfmTableFromMarkdown(), gfmStrikethroughFromMarkdown(), gfmTaskListItemFromMarkdown()],
    }) as Parent;

    /**
     * Flatten all nested structures in blockquote, because cu's blockquote only supports paragraphs
     */
    const normalizedTree = normalizeTreeNode(tree);

    if (this.options.debug) {
      console.log('tree', normalizedTree);
    }
    const delta = this.convertChildren(null, normalizedTree, {});
    return delta.ops;
  }

  private convertCodeBlock(child: any, defaultLang: boolean | string = true, inList = false): Delta {
    const delta = new Delta;
    const lines = String(child.value).split('\n');
    lines.forEach(line => {
      if (line) {
        delta.push({ insert: line });
      }
      const attributes = inList
        ? {
          'code-block': {
            'code-block': child.lang ?? defaultLang,
            'in-list': 'none',
          },
        }
        : {
          'code-block': {
            'code-block': child.lang ?? defaultLang,
          },
        };
      delta.push({
        insert: '\n',
        attributes,
      });
    });

    return delta;
  }

  private convertChildren(
    parent: Node | Parent,
    node: Node | Parent,
    op: Op = {},
    indent = 0,
    extra?: any
  ): Delta {
    const { children } = node as any;
    let delta = new Delta();
    if (children) {
      if (this.options.debug) {
        console.log('children:', children, extra);
      }
      let prevType;
      children.forEach((child, idx) => {
        if (this.isBlock(child.type) && this.isBlock(prevType)) {
          if (this.options.preciseLineBreak) {
            const diff = child.position.start.line - this.prevEndLine;
            for (let i = 1; i < diff; i++) {
              delta.insert('\n', this.splitAttributes ?? {});
            }
          } else {
            delta.insert('\n', this.splitAttributes ?? {});
          }
        }
        switch (child.type) {
          case 'paragraph':
            delta = delta.concat(
              this.convertChildren(node, child, op, indent + 1)
            );
            if (!parent) {
              delta.insert('\n');
            }
            break;
          case 'code':
            delta = delta.concat(this.convertCodeBlock(child));
            break;
          case 'list':
            delta = delta.concat(this.convertChildren(node, child, op, indent));
            break;
          case 'listItem':
            delta = delta.concat(this.convertListItem(node, child, indent));
            break;
          case 'table':
            // insert table cols
            const firstRow = child.children[0];
            const colNumber = firstRow.children.length;
            const colsInsertStr = new Array(colNumber).fill('\n').join('');
            delta = delta.concat(
              new Delta().insert(colsInsertStr, { 'table-col': { width: '150' } })
            );

            delta = delta.concat(
              this.convertChildren(node, child, op, indent, {
                align: (child as any).align
              })
            );
            break;
          case 'tableRow':
            delta = delta.concat(
              this.convertChildren(node, child, op, indent, {
                ...extra,
                rowId: this.generateId()
              })
            );
            break;
          case 'tableCell':
            const cellIndex = children.indexOf(child) + 1 + '';
            const align = extra && extra.align;
            const alignCell =
              align && Array.isArray(align) && align.length > idx && align[idx];
            if (this.options.debug) {
              console.log('align', alignCell, align, idx);
            }
            delta = delta.concat(
              this.convertTableCell(
                node,
                child,
                extra && extra.rowId,
                alignCell,
                cellIndex
              )
            );
            break;
          case 'heading':
            delta = delta.concat(
              this.convertChildren(node, child, op, indent + 1)
            );
            delta.push({
              insert: '\n',
              attributes: { header: child.depth || 1 }
            });
            break;
          case 'blockquote':
            delta = delta.concat(
              this.convertChildren(node, child, op, indent + 1)
            );
            delta.push({ insert: '\n', attributes: { blockquote: {} } });
            break;
          case 'thematicBreak':
            delta.insert({ divider: true });
            delta.insert('\n');
            break;
          case 'break':
            delta.insert('\n');
            break;
          case 'link':
            delta = delta.concat(this.convertLinkItem(child));
            break;
          case 'image':
            delta = delta.concat(
              this.embedFormat(
                child,
                op,
                { image: child.url },
                child.alt ? { alt: child.alt } : null
              )
            );
          case 'html':
            if (
              this.options.enableCustomHtmlConverter &&
              typeof this.options.customHtmlConverter === 'function'
            ) {
              const d = this.options.customHtmlConverter(node, child, op, indent);
              if (d) {
                delta = delta.concat(d);
              }
              break;
            }
          default:
            const d = this.convertInline(node, child, op);
            if (d) {
              delta = delta.concat(d);
            }
        }

        prevType = child.type;
        this.prevEndLine = child.position.end.line;
      });
    }
    return delta;
  }

  private generateId() {
    return this.options.tableIdGenerator();
  }

  private isBlock(type: string) {
    return this.blocks.includes(type);
  }

  private convertInline(parent: any, child: any, op: Op): Delta {
    switch (child.type) {
      case 'strong':
        return this.inlineFormat(parent, child, op, { bold: true });
      case 'emphasis':
        return this.inlineFormat(parent, child, op, { italic: true });
      case 'delete':
        return this.inlineFormat(parent, child, op, { strike: true });
      case 'inlineCode':
        return this.inlineFormat(parent, child, op, { code: true });
      case 'text':
      default:
        return this.inlineFormat(parent, child, op, {});
    }
  }

  private inlineFormat(parent: any, node: any, op: Op, attributes: any): Delta {
    const text = node.value && typeof node.value === 'string' ? node.value : null;
    const newAttributes = { ...op.attributes, ...attributes };
    op = { ...op };

    if (text) {
      op.insert = text;
    }

    if (Object.keys(newAttributes).length) {
      op.attributes = newAttributes;
    }

    if (node.children) {
      return this.convertChildren(parent, node, op);
    }
    const result = new Delta();

    if (op.insert) {
      if (typeof op.insert === 'string' && this.splitAttributes) {
        const slices = op.insert.split('\n');
        if (slices.length === 1) {
          result.push(op);
        } else {
          for (let i = 0; i < slices.length; i++) {
            const slice = slices[i];
            if (
              i > 0 &&
              !this.splitAttributes['blockquote']
            ) {
              this.splitAttributes['list'] = 'none';
            }
            if (slice) {
              result.insert(slice);
            }
            if (i < slices.length - 1 || slice === '') {
              result.insert('\n', this.splitAttributes);
            }
          }
        }
      } else {
        result.push(op);
      }
    }

    return result;
  }

  private embedFormat(node: any, op: Op, value: any, attributes?: any): Delta {
    return new Delta().push({
      insert: value,
      attributes: { ...op.attributes, ...attributes }
    });
  }


  private convertLinkItem(node: any): Delta {
    const result = new Delta();

    const link: string | undefined = node?.url;
    const linkText: string | undefined = node?.children?.[0]?.value;
    if (link && linkText) {
      const linkSections = linkText.split('\\n');
      const hasMultipleLines = linkSections.length > 1;
      if (!hasMultipleLines) {
        result.insert(linkText, {link});
      } else {
        for (let i = 0; i < linkSections.length; i++) {
          const linkSection = linkSections[i];
          if (linkSection !== '') {
            result.insert(linkSections[i], {link});
          }
          if (i < linkSections.length - 1) {
            result.insert('\n');
          }
        }
      }
    } else {
      if (this.options.debug) {
        console.log('link or linkText not found on node:', {node, link, linkText});
      }
    }

    return result;
  }

  private getListAttributes(parent: any, node: any, indent: number): { list: string; indent?: number } {
    let listAttribute = '';
    if (parent.ordered) {
      listAttribute = 'ordered';
    } else if (node.checked) {
      listAttribute = 'checked';
    } else if (node.checked === false) {
      listAttribute = 'unchecked';
    } else {
      listAttribute = 'bullet';
    }

    const attributes: { list: string; indent?: number } = { list: listAttribute };
    if (indent) {
      attributes.indent = indent;
    }

    return attributes;
  }

  private convertListItemChild(parent: any, node: any, child: any, indent: number): Delta {
    let delta = new Delta();

    if (child.type === 'code') {
      delta = delta.concat(this.convertCodeBlock(child, 'plain', true));
    } else if (child.type === 'blockquote') {
      let prevAttributes = this.splitAttributes;
      const attributes = { blockquote: { 'in-list': 'none' } };
      this.splitAttributes = attributes;
      delta = delta.concat(this.convertChildren(parent, child, {}, indent + 1));
      delta.insert('\n', attributes);
      this.splitAttributes = prevAttributes;
    } else if (child.type !== 'list') {
      let prevAttributes = this.splitAttributes;
      const attributes = this.getListAttributes(parent, node, indent);
      this.splitAttributes = attributes;
      delta = delta.concat(this.convertChildren(parent, child, {}, indent + 1));
      delta.insert('\n', attributes);
      this.splitAttributes = prevAttributes;
    } else {
      delta = delta.concat(this.convertChildren(parent, child, {}, indent + 1));
    }

    return delta;
  }

  private convertListItem(parent: any, node: any, indent = 0): Delta {
    let delta = new Delta();
    for (const child of node.children) {
      delta = delta.concat(this.convertListItemChild(parent, node, child, indent));
    }
    if (this.options.debug) {
      console.log('list item', delta.ops);
    }
    return delta;
  }

  private convertTableCell(
    parent: any,
    node: any,
    rowId: string,
    align: string,
    cellId: string
  ): Delta {
    const SYMBOLS_TO_SPLIT = ['<br>', '<br/>'];
    const attributes: any = {};
    if (align && align !== 'left') {
      attributes.align = align;
    }
    const tableFormats = {
      cell: `${rowId}-${cellId}`,
      row: `${rowId}`,
      colspan: '1',
      rowspan: '1'
    };

    let delta = new Delta();
    let hasMultiLineInThisCell = false;
    delta = delta.concat(this.convertChildren(parent, node, {}, 1));
    delta = delta.ops.reduce((newDelta: Delta, op: Op) => {
      if (
        typeof op.insert === 'string' &&
        SYMBOLS_TO_SPLIT.some(symbol => (op.insert as string).includes(symbol))
      ) {
        hasMultiLineInThisCell = true;
        const lines: Array<string> = SYMBOLS_TO_SPLIT.reduce(
          (strs, symbol) => {
            return strs.reduce(
              (lines, str) => lines.concat(str.split(symbol)),
              []
            );
          },
          [op.insert]
        );
        lines
          .map(str => {
            return this.convert(str);
          })
          .forEach(ops => {
            ops.forEach(op => {
              if ((op.insert as string).endsWith('\n')) {
                if (op.attributes && op.attributes.list) {
                  newDelta.insert(op.insert, {
                    ...attributes,
                    list: {
                      ...tableFormats,
                      list: op.attributes.list
                    }
                  });
                } else {
                  newDelta.insert(op.insert, {
                    ...attributes,
                    'table-cell-line': tableFormats
                  });
                }
              } else {
                newDelta.push(op);
              }
            });
          });
      } else {
        newDelta.push(op);
      }
      return newDelta;
    }, new Delta());

    if (!hasMultiLineInThisCell) {
      delta.insert('\n', {
        ...attributes,
        'table-cell-line': tableFormats
      });
    }

    if (this.options.debug) {
      console.log('table cell', delta.ops, align);
    }
    return delta;
  }
}

export function getFlattenParagraphs(node: any): Parent[] {
  if (node.children) {
    return node.children.reduce((arr, child) => {
      if (child.type === 'paragraph') {
        arr.push(child);
      } else if (child.children) {
        arr.push(...getFlattenParagraphs(child));
      }
      return arr;
    }, []);
  }
  return [];
}

/**
 * #1 Flatten all nested structures in blockquote, because cu's blockquote only supports paragraphs
 * @param root Parent
 * @returns Parent
 */
export function normalizeTreeNode(root: any): Parent {
  if (root.children) {
    return {
      ...root,
      children: root.children.map((child) => {
        if (child.type === 'blockquote') {
          return {
            ...child,
            children: getFlattenParagraphs(child),
          };
        }
        return normalizeTreeNode(child);
      }),
    };
  }
  return root;
}
