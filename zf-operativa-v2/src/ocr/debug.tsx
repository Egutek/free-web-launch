import React from 'react';
import type { BoardDiagnostics } from './diagnostics';

export function DebugPanel({ data }: { data: BoardDiagnostics | null }) {
  if (!data) {
    return <div>No diagnostics available yet.</div>;
  }

  return (
    <section style={{ marginTop: 24, border: '1px solid #dfe3ea', borderRadius: 12, padding: 16, background: '#fff' }}>
      <h3>OCR Debug</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <div><strong>Board detection</strong><div>{data.boardDetected ? 'Detected' : 'Not detected'}</div></div>
        <div><strong>Detected areas</strong><div>{data.detectedAreas.length}</div></div>
        <div><strong>Detected magnets</strong><div>{data.detectedMagnets}</div></div>
        <div><strong>Avg confidence</strong><div>{data.confidence.toFixed(2)}</div></div>
        <div><strong>Assigned</strong><div>{data.assignment.length}</div></div>
        <div><strong>Blocking issues</strong><div>{data.reviewState.blockingIssues.length}</div></div>
      </div>

      <div style={{ marginTop: 16 }}>
        <h4>OCR results</h4>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#f8fafc', padding: 12, borderRadius: 8 }}>
          {JSON.stringify(data.ocrResults, null, 2)}
        </pre>
      </div>

      <div style={{ marginTop: 16 }}>
        <h4>Assignment</h4>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#f8fafc', padding: 12, borderRadius: 8 }}>
          {JSON.stringify(data.assignment, null, 2)}
        </pre>
      </div>
    </section>
  );
}
