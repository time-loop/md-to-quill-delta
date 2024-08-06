import Op from 'quill-delta/dist/Op';
import Delta from "quill-delta";
import { Parent } from 'unist';

export const defaultCustomHtmlConverter = (
  parent: Node | Parent,
  node: any,
  op: Op = {},
  indent = 0,
): Delta | undefined => {
  if (node.type !== 'html') {
    return;
  }

  if (
    (node.value as string).startsWith('<details') &&
    (node.value as string).endsWith('</details>')
  ) {
    return new Delta()
      .insert('Toggle title')
      .insert('\n', {
        list: {
          list: 'toggled',
        }
      })
      .insert('Toggle content')
      .insert('\n', {
        list: {
          list: 'none',
          indent: 1,
        }
      })
  }

  return;
}
