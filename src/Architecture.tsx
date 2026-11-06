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
  "cache",
  "relay",
  "queue",
  "worker",
  "expiry-worker",
  "cdn",
];
const icons: Record<string, string> = {
  api: "ec2",
  database: "rds",
  balancer: "alb",
  photos: "s3",
};
const subscribe = (callback: () => void) => {
  const queries = ["(max-width: 1100px)", "(max-width: 1700px)"].map((q) =>
    window.matchMedia(q),
  );
  queries.forEach((q) => q.addEventListener("change", callback));
  return () =>
    queries.forEach((q) => q.removeEventListener("change", callback));
};

function port(
  node: Component,
  toward: { x: number; y: number },
  target = false,
) {
  const cx = node.x + nodeWidth / 2;
  const cy = node.y + nodeHeight / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  const padding = target ? 3 : 0;
  return Math.abs(dx / nodeWidth) > Math.abs(dy / nodeHeight)
    ? { x: cx + Math.sign(dx) * (nodeWidth / 2 + padding), y: cy }
    : { x: cx, y: cy + Math.sign(dy) * (nodeHeight / 2 + padding) };
}

export function Architecture({
  frame: fullFrame,
  before,
  focus,
}: {
  frame: DiagramFrame;
  before: DiagramFrame;
  focus?: { ids: string[]; label: string };
}) {
  const id = useId();
  const layout = useSyncExternalStore(
    subscribe,
    () =>
      (window.matchMedia("(max-width: 1100px)").matches ? 1 : 0) |
      (window.matchMedia("(max-width: 1700px)").matches ? 2 : 0),
    () => 0,
  );
  const narrow = (layout & 1) !== 0;
  const fullWidth =
    Math.max(...fullFrame.components.map((c) => c.x + nodeWidth)) -
    Math.min(...fullFrame.components.map((c) => c.x));
  const focused =
    !!focus && (narrow || ((layout & 2) !== 0 && fullWidth > 1000));
  const visible = new Set(
    focused ? focus!.ids : fullFrame.components.map((c) => c.id),
  );
  const frame = {
    components: fullFrame.components.filter((c) => visible.has(c.id)),
    connections: fullFrame.connections.filter(
      (e) => visible.has(e.from) && visible.has(e.to),
    ),
  };
  const sorted = [...frame.components].sort((a, b) => {
    const ordering = focused ? focus!.ids : order;
    const rank = (id: string) =>
      ordering.indexOf(id) < 0 ? ordering.length : ordering.indexOf(id);
    return rank(a.id) - rank(b.id);
  });
  const components = sorted.map((component, index) =>
    narrow
      ? { ...component, x: 20, y: 20 + index * 120 }
      : focused
        ? {
            ...component,
            ...[
              { x: 20, y: 20 },
              { x: 320, y: 20 },
              { x: 320, y: 220 },
              { x: 20, y: 220 },
            ][index]!,
          }
        : component,
  );
  const viaPoints =
    narrow || focused ? [] : frame.connections.flatMap((e) => e.via ?? []);
  const minX =
    narrow || focused
      ? 0
      : Math.max(
          0,
          Math.min(
            ...components.map((c) => c.x),
            ...viaPoints.map((p) => p.x),
          ) - 24,
        );
  const minY =
    narrow || focused
      ? 0
      : Math.max(
          0,
          Math.min(
            ...components.map((c) => c.y),
            ...viaPoints.map((p) => p.y),
          ) - 24,
        );
  const width = narrow
    ? Math.max(320, 290 + (frame.connections.length - 1) * 10)
    : Math.max(
        ...components.map((c) => c.x + nodeWidth),
        ...viaPoints.map((p) => p.x),
      ) +
      24 -
      minX;
  const height =
    Math.max(
      ...components.map((c) => c.y + nodeHeight),
      ...viaPoints.map((p) => p.y),
    ) +
    28 -
    minY;
  const changed = (component: Component) => {
    const old = before.components.find((item) => item.id === component.id);
    return (
      !old ||
      old.name !== component.name ||
      old.purpose !== component.purpose ||
      !!old.unavailable !== !!component.unavailable
    );
  };
  const connectionList = (
    <ol>
      {frame.connections.map((connection) => (
        <li key={`${connection.from}-${connection.to}`}>
          <span>
            {frame.components.find((c) => c.id === connection.from)!.name} →{" "}
            {frame.components.find((c) => c.id === connection.to)!.name}
          </span>
          <small>{connection.label}</small>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      {focused && (
        <p className="diagram-focus">
          {focus!.label} · {frame.components.length} of{" "}
          {fullFrame.components.length} established components
        </p>
      )}
      <svg
        className={`architecture${narrow ? " compact" : ""}${focused ? " focused" : ""}`}
        viewBox={`${minX} ${minY} ${width} ${height}`}
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
          } else if (connection.via?.length && !focused) {
            const start = port(from, connection.via[0]!);
            const end = port(to, connection.via.at(-1)!, true);
            path = `M${start.x} ${start.y} ${connection.via.map((p) => `L${p.x} ${p.y}`).join(" ")} L${end.x} ${end.y}`;
            labelX = (connection.via[0]!.x + connection.via.at(-1)!.x) / 2;
            labelY = connection.via[0]!.y - 10;
          } else if (from.x === to.x) {
            const up = from.y > to.y;
            path = `M${from.x + 106} ${from.y + (up ? 0 : nodeHeight)} V${to.y + (up ? nodeHeight + 3 : -3)}`;
            labelX = from.x + 137;
            labelY = (from.y + to.y + nodeHeight) / 2;
          } else {
            const rightward = from.x < to.x;
            const startX = from.x + (rightward ? nodeWidth : 0);
            const endX = to.x + (rightward ? -3 : nodeWidth + 3);
            const middleX = (startX + endX) / 2;
            path = `M${startX} ${from.y + 44} C${middleX} ${from.y + 44} ${middleX} ${to.y + 44} ${endX} ${to.y + 44}`;
            labelX = middleX;
            labelY = from.y === to.y ? from.y - 14 : (from.y + to.y) / 2 + 28;
          }
          if (connection.labelAt && !narrow && !focused) {
            labelX = connection.labelAt.x;
            labelY = connection.labelAt.y;
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
                {narrow || focused ? index + 1 : connection.label}
              </text>
            </g>
          );
        })}
        {components.map((component) => (
          <g
            key={component.id}
            transform={`translate(${component.x} ${component.y})`}
            className={`system-node${changed(component) ? " changed" : ""}${component.unavailable ? " unavailable" : ""}`}
            aria-hidden="true"
            data-component={component.id}
          >
            <rect width={nodeWidth} height={nodeHeight} rx="10" />
            {component.service || icons[component.id] ? (
              <image
                href={`/aws/${component.service ?? icons[component.id]}.svg`}
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
      {frame.connections.length > 0 &&
        (focused ? (
          <div className="diagram-description focused-connections">
            {connectionList}
          </div>
        ) : (
          <details className="diagram-description">
            <summary>Read the connections</summary>
            {connectionList}
          </details>
        ))}
    </>
  );
}
