import { useId, useSyncExternalStore } from "react";
import type { Component, DiagramFrame } from "./content.ts";

const nodeWidth = 212;
const nodeHeight = 88;
const order = [
  "customer",
  "restaurant",
  "balancer",
  "api",
  "database",
  "photos",
];
const icons: Record<string, string> = {
  api: "ec2",
  database: "rds",
  balancer: "alb",
  photos: "s3",
};
const subscribe = (callback: () => void) => {
  const query = window.matchMedia("(max-width: 640px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};

export function Architecture({
  frame,
  before,
}: {
  frame: DiagramFrame;
  before: DiagramFrame;
}) {
  const id = useId();
  const narrow = useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(max-width: 640px)").matches,
    () => false,
  );
  const sorted = [...frame.components].sort(
    (a, b) => order.indexOf(a.id) - order.indexOf(b.id),
  );
  const components = sorted.map((component, index) =>
    narrow ? { ...component, x: 20, y: 20 + index * 120 } : component,
  );
  const width = narrow
    ? 320
    : Math.max(...components.map((component) => component.x)) + nodeWidth + 24;
  const height =
    Math.max(...components.map((component) => component.y)) + nodeHeight + 28;
  const changed = (component: Component) => {
    const old = before.components.find((item) => item.id === component.id);
    return (
      !old || old.name !== component.name || old.purpose !== component.purpose
    );
  };

  return (
    <>
      <svg
        className="architecture"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby={`${id}-title ${id}-description`}
      >
        <title id={`${id}-title`}>Current system architecture</title>
        <desc id={`${id}-description`}>
          {frame.components
            .map((component) => `${component.name}: ${component.purpose}`)
            .join(". ")}
          .{" "}
          {frame.connections
            .map(
              (connection) =>
                `${frame.components.find((component) => component.id === connection.from)!.name} to ${frame.components.find((component) => component.id === connection.to)!.name}: ${connection.label}`,
            )
            .join(". ")}
        </desc>
        <defs>
          <marker
            id={`${id}-arrow`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 10 5 0 10Z" fill="#8c8c8c" />
          </marker>
        </defs>
        {frame.connections.map((connection, index) => {
          const from = components.find(
            (component) => component.id === connection.from,
          )!;
          const to = components.find(
            (component) => component.id === connection.to,
          )!;
          let path: string;
          let labelX: number;
          let labelY: number;
          if (narrow) {
            const lane = 258 + index * 10;
            path = `M${from.x + nodeWidth} ${from.y + 44} H${lane} V${to.y + 44} H${to.x + nodeWidth + 3}`;
            labelX = lane + 8;
            labelY = (from.y + to.y) / 2 + 48;
          } else if (from.x === to.x) {
            const up = from.y > to.y;
            path = `M${from.x + 106} ${from.y + (up ? 0 : nodeHeight)} V${to.y + (up ? nodeHeight + 3 : -3)}`;
            labelX = from.x + 137;
            labelY = (from.y + to.y + nodeHeight) / 2;
          } else {
            const startX = from.x + nodeWidth;
            const endX = to.x - 3;
            const middleX = (startX + endX) / 2;
            path = `M${startX} ${from.y + 44} C${middleX} ${from.y + 44} ${middleX} ${to.y + 44} ${endX} ${to.y + 44}`;
            labelX = middleX;
            labelY = (from.y + to.y) / 2 + 28;
          }
          return (
            <g key={`${connection.from}-${connection.to}`} aria-hidden="true">
              <path
                className="connection"
                d={path}
                markerEnd={`url(#${id}-arrow)`}
              />
              <text
                className="connection-label"
                x={labelX}
                y={labelY}
                textAnchor={narrow ? "start" : "middle"}
              >
                {narrow ? index + 1 : connection.label}
              </text>
            </g>
          );
        })}
        {components.map((component) => (
          <g
            key={component.id}
            transform={`translate(${component.x} ${component.y})`}
            className={
              changed(component) ? "system-node changed" : "system-node"
            }
            aria-hidden="true"
            data-component={component.id}
          >
            <rect width={nodeWidth} height={nodeHeight} rx="10" />
            {icons[component.id] ? (
              <image
                href={`/aws/${icons[component.id]}.svg`}
                x="16"
                y="14"
                width="25"
                height="25"
              />
            ) : (
              <g transform="translate(16 13)" className="actor-icon">
                <circle cx="12" cy="7" r="5" />
                <path d="M3 24v-3a9 9 0 0 1 18 0v3" />
              </g>
            )}
            <text x="52" y="32" className="node-name">
              {component.name}
            </text>
            <text x="16" y="65" className="node-purpose">
              {component.purpose}
            </text>
          </g>
        ))}
      </svg>
      {frame.connections.length > 0 && (
        <details className="diagram-description">
          <summary>Read the connections</summary>
          <ol>
            {frame.connections.map((connection) => (
              <li key={`${connection.from}-${connection.to}`}>
                <span>
                  {
                    frame.components.find(
                      (component) => component.id === connection.from,
                    )!.name
                  }{" "}
                  →{" "}
                  {
                    frame.components.find(
                      (component) => component.id === connection.to,
                    )!.name
                  }
                </span>
                <small>{connection.label}</small>
              </li>
            ))}
          </ol>
        </details>
      )}
    </>
  );
}
