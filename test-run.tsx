import React from 'react';
import { renderToString } from 'react-dom/server';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useBlocker } from 'react-router-dom';

function Test() {
  try {
    useBlocker(() => true);
    console.log("useBlocker successful");
  } catch (e: any) {
    console.log("useBlocker error:", e.message);
  }
  return <div>Test</div>;
}

try {
  console.log(renderToString(
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Test />} />
      </Routes>
    </BrowserRouter>
  ));
} catch (e: any) {
  console.log("Root error:", e.message);
}
