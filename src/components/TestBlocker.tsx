import React from 'react';
import { useBlocker } from 'react-router-dom';

export function TestBlocker() {
    useBlocker(() => true);
    return null;
}
