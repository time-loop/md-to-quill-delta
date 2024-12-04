import { getFlattenParagraphs, normalizeTreeNode } from "../src/mdToDelta";

describe('getFlattenParagraphs', () => {
  test('get child paragraphs', () => {
    const mockNode = {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', value: '1' }] },
        { type: 'list', children: [{ type: 'listitem', children: [{ type: 'paragraph', children: [{ type: 'text', value: '2' }] }, { type: 'paragraph', children: [{ type: 'text', value: '3' }] }] }] },
      ],
    };
    expect(getFlattenParagraphs(mockNode).length).toBe(3);
  });

  test('get 1 child paragraphs', () => {
    const mockNode = {
      type: 'root',
      children: [
        { type: 'list', children: [{ type: 'listitem', children: [{ type: 'paragraph', children: [{ type: 'text', value: '2' }] }] }] },
      ],
    };
    expect(getFlattenParagraphs(mockNode).length).toBe(1);
  });
});

const mockTree = {
  "type": "root",
  "children": [
    {
      "type": "list",
      "ordered": true,
      "children": [
        {
          "type": "listItem",
          "children": [
            {
              "type": "paragraph",
              "children": [
                {
                  "type": "text",
                  "value": "milk",
                }
              ],
            },
            {
              "type": "blockquote",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "value": "banana",
                    }
                  ],
                },
                {
                  "type": "list",
                  "ordered": false,
                  "children": [
                    {
                      "type": "listItem",
                      "children": [
                        {
                          "type": "paragraph",
                          "children": [
                            {
                              "type": "text",
                              "value": "peach",
                            }
                          ],
                        }
                      ],
                    }
                  ],
                },
                {
                  "type": "blockquote",
                  "children": [
                    {
                      "type": "list",
                      "ordered": false,
                      "children": [
                        {
                          "type": "listItem",
                          "children": [
                            {
                              "type": "paragraph",
                              "children": [
                                {
                                  "type": "text",
                                  "value": "bean",
                                }
                              ],
                            }
                          ],
                        }
                      ],
                    }
                  ],
                }
              ],
            }
          ],
        },
        {
          "type": "listItem",
          "children": [
            {
              "type": "paragraph",
              "children": [
                {
                  "type": "text",
                  "value": "cheese",
                }
              ],
            },
            {
              "type": "blockquote",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "value": "apple",
                    }
                  ],
                }
              ],
            }
          ],
        }
      ],
    }
  ],
};

const normalizedTree = {
  "type": "root",
  "children": [
    {
      "type": "list",
      "ordered": true,
      "children": [
        {
          "type": "listItem",
          "children": [
            {
              "type": "paragraph",
              "children": [
                {
                  "type": "text",
                  "value": "milk",
                }
              ],
            },
            {
              "type": "blockquote",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "value": "banana",
                    }
                  ],
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "value": "peach",
                    }
                  ],
                },
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "value": "bean",
                    }
                  ],
                }
              ],
            }
          ],
        },
        {
          "type": "listItem",
          "children": [
            {
              "type": "paragraph",
              "children": [
                {
                  "type": "text",
                  "value": "cheese",
                }
              ],
            },
            {
              "type": "blockquote",
              "children": [
                {
                  "type": "paragraph",
                  "children": [
                    {
                      "type": "text",
                      "value": "apple",
                    }
                  ],
                }
              ],
            }
          ],
        }
      ],
    }
  ],
};

describe('normalizeTreeNode', () => {
  test('Flatten all nested structures in blockquote', () => {
    expect(normalizeTreeNode(mockTree)).toEqual(normalizedTree);
  });
});
