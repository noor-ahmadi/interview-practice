import { useId, useState } from "react";
import type { MouseEventHandler, RefObject } from "react";
import { Architecture } from "./Architecture.tsx";
import type { DiagramFrame } from "./content.ts";

function DiagramZoom({
  frame,
  before,
}: {
  frame: DiagramFrame;
  before: DiagramFrame;
}) {
  const [zoom, setZoom] = useState(1);
  return (
    <>
      <div className="zoom-controls">
        <button
          className="icon-button"
          aria-label="Zoom out"
          disabled={zoom <= 0.75}
          onClick={() => setZoom((value) => Math.max(0.75, value - 0.25))}
        >
          −
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          className="icon-button"
          aria-label="Zoom in"
          disabled={zoom >= 2}
          onClick={() => setZoom((value) => Math.min(2, value + 0.25))}
        >
          +
        </button>
        <button className="text-button" onClick={() => setZoom(1)}>
          Reset
        </button>
      </div>
      <div className="expanded-viewport">
        <div style={{ width: `${zoom * 100}%`, fontSize: `${zoom * 100}%` }}>
          <Architecture frame={frame} before={before} />
        </div>
      </div>
      <ul className="component-list">
        {frame.components.map((component) => (
          <li key={component.id}>
            <strong>{component.name}</strong>
            <span>{component.purpose}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function DiagramDialog({
  dialog,
  title,
  caption,
  frame,
  before,
  onClose,
}: {
  dialog: RefObject<HTMLDialogElement | null>;
  title: string;
  caption?: string;
  frame?: DiagramFrame;
  before: DiagramFrame;
  onClose: () => void;
}) {
  const id = useId();
  return (
    <dialog
      className="diagram-dialog"
      ref={dialog}
      onClose={onClose}
      aria-labelledby={id}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialog.current?.close();
      }}
    >
      {frame && (
        <div className="dialog-content">
          <div className="dialog-heading">
            <h2 id={id}>{title}</h2>
            <button
              autoFocus
              className="text-button"
              onClick={() => dialog.current?.close()}
            >
              Close
            </button>
          </div>
          {caption && <p className="saved-diagram-title">{caption}</p>}
          <DiagramZoom frame={frame} before={before} />
        </div>
      )}
    </dialog>
  );
}

export function ExpandDiagramButton({
  onClick,
}: {
  onClick: MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      className="icon-button"
      aria-label="Expand architecture diagram"
      onClick={onClick}
    >
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5M4 4l6 6m10-6-6 6M4 20l6-6m10 6-6-6" />
      </svg>
    </button>
  );
}
