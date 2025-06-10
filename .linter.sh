#!/bin/bash
cd /home/kavia/workspace/code-generation/travelsmart-ai-77-f6fe673a/travelsmart_ai
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

