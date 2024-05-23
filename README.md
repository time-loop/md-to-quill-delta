# md-to-quill-delta

[![NPM](https://nodei.co/npm/md-to-quill-delta.png)](https://nodei.co/npm/md-to-quill-delta/)  
[![Build Status](https://travis-ci.org/volser/md-to-quill-delta.svg?branch=master)](https://travis-ci.org/volser/md-to-quill-delta)


## Usage

```typescript
import { MarkdownToQuill } from 'md-to-quill-delta';

const options = { debug: false };
const converter = new MarkdownToQuill(options);
const ops = converter.convert(markdown);
```

# Publish

1. Bump package.json version number (and make sure that eventually makes it in master)
2. Drop to node 16
3. Make sure dependencies are installed with npm and not pnpm
4. Run `npm version patch`