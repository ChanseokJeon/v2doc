#!/usr/bin/env node

/**
 * v2doc CLI 실행 파일
 */

// Node.js 22에서 punycode 모듈 deprecation 경고 억제 (의존성에서 발생)
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name !== 'DeprecationWarning' || !warning.message.includes('punycode')) {
    console.warn(warning);
  }
});

import { run } from '../cli/index.js';

run();
