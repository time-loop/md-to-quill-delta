import Op from 'quill-delta/dist/Op';
import Delta from 'quill-delta';
import unified from 'unified';
import markdown from 'remark-parse';
import { Parent } from 'unist';

function flatten(arr: any[]): any[] {
  return arr.reduce((flat, next) => flat.concat(next), []);
}

type NodeHandler = (node: Parent, nextType: string, attributes: any) => Op[];

export class MarkdownToQuill {
  delta: Delta;
  options: { debug?: boolean };
  constructor(private md: string, options?: any) {
    this.options = { ...options };
  }

  convert(): Op[] {
    const processor = unified().use(markdown);
    const tree: Parent = processor.parse(this.md) as Parent;

    this.delta = new Delta();
    if (this.options.debug) {
      console.log('tree', tree);
    }
    this.parseItems(tree.children as Parent[]);
    return this.delta.ops;
  }

  private parseItems(items: Parent[]) {
    for (let idx = 0; idx < items.length; idx++) {
      const child = items[idx];
      const nextType: string =
        idx + 1 < items.length ? items[idx + 1].type : 'lastOne';

      if (child.type === 'paragraph') {
        this.paragraphVisitor(child);
        this.delta.insert('\n');

        if (
          nextType === 'paragraph' ||
          nextType === 'code' ||
          nextType === 'heading'
        ) {
          this.delta.insert('\n');
        }
      } else if (child.type === 'list') {
        this.listVisitor(child);
        if (nextType === 'list') {
          this.delta.insert('\n');
        }
      } else if (child.type === 'code') {
        const lines = String(child.value).split('\n');
        lines.forEach(line => {
          this.delta.push({ insert: line });
          this.delta.push({ insert: '\n', attributes: { 'code-block': true } });
        });

        if (nextType === 'paragraph') {
          this.delta.insert('\n');
        }
      } else if (child.type === 'heading') {
        this.headingVisitor(child);
        this.delta.insert('\n');
      } else if (child.type === 'blockquote') {
        this.paragraphVisitor(child);
        this.delta.push({ insert: '\n', attributes: { blockquote: true } });
      } else if (child.type === 'thematicBreak') {
        this.delta.insert({ divider: true });
        this.delta.insert('\n');
      } else {
        this.delta.push({
          insert: String(child.value)
        });
        console.log(`Unsupported child type: ${child.type}, ${child.value}`);
      }
    }
  }

  private paragraphVisitor(node: any, initialOp: Op = {}, indent = 0) {
    const { children } = node;
    if (this.options.debug) {
      console.log('children', children);
    }

    const visitNode = (node: any, op: Op): Op[] | Op => {
      if (node.type === 'text') {
        op = { ...op, insert: node.value };
      } else if (node.type === 'strong') {
        op = { ...op, attributes: { ...op.attributes, bold: true } };
        return visitChildren(node, op);
      } else if (node.type === 'emphasis') {
        op = { ...op, attributes: { ...op.attributes, italic: true } };
        return visitChildren(node, op);
      } else if (node.type === 'delete') {
        op = { ...op, attributes: { ...op.attributes, strike: true } };
        return visitChildren(node, op);
      } else if (node.type === 'image') {
        op = { insert: { image: node.url } };
        if (node.alt) {
          op = { ...op, attributes: { alt: node.alt } };
        }
      } else if (node.type === 'link') {
        const text = visitChildren(node, op);
        op = { ...text, attributes: { ...op.attributes, link: node.url } };
      } else if (node.type === 'inlineCode') {
        op = {
          insert: node.value,
          attributes: { ...op.attributes, code: true }
        };
      } else if (node.type === 'paragraph') {
        return visitChildren(node, op);
      } else {
        if (node.value) {
          op = {
            insert: node.value
          };
        }
        console.log(
          `Unsupported note type in paragraph: ${node.type}, ${node.value}`
        );
      }
      return op;
    };

    const visitChildren = (node: any, op: Op): Op[] => {
      const { children } = node;
      const ops = children.map((child: any) => visitNode(child, op));
      return ops.length === 1 ? ops[0] : ops;
    };

    for (const child of children) {
      const localOps = visitNode(child, initialOp);

      if (localOps instanceof Array) {
        flatten(localOps).forEach(op => this.delta.push(op));
      } else {
        this.delta.push(localOps);
      }
    }
  }

  private listItemVisitor(listNode: any, node: any, indent = 0) {
    for (const child of node.children) {
      if (child.type === 'list') {
        this.listVisitor(child, indent + 1);
      } else {
        this.paragraphVisitor(child);

        let listAttribute = '';
        if (listNode.ordered) {
          listAttribute = 'ordered';
        } else if (node.checked) {
          listAttribute = 'checked';
        } else if (node.checked === false) {
          listAttribute = 'unchecked';
        } else {
          listAttribute = 'bullet';
        }
        const attributes = { list: listAttribute };
        if (indent) {
          attributes['indent'] = indent;
        }

        this.delta.push({ insert: '\n', attributes });
      }
    }
  }

  private listVisitor(node: any, indent = 0) {
    node.children.forEach(n => {
      if (n.type === 'listItem') {
        this.listItemVisitor(node, n, indent);
      }
    });
  }

  private headingVisitor(node: any) {
    this.paragraphVisitor(node);
    this.delta.push({ insert: '\n', attributes: { header: node.depth || 1 } });
  }
}
