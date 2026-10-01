import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ChevronRight, Search, Shapes, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { aceternityMotion } from "@/lib/aceternity-motion";
import { canvasThemes } from "@/lib/canvas-theme";
import { useActiveTheme } from "@/stores/canvas/use-canvas-theme-store";

export type CanvasCreateCommand = {
    id: string;
    label: string;
    icon: ReactNode;
    badge?: string;
    section: "node" | "workflow" | "project" | "resource";
    onClick: () => void;
};

const PRIMARY_NODE_ORDER = [
    "text",
    "image",
    "video",
    "audio",
    "script",
    "director",
];

const PRIMARY_NODE_IDS = new Set(PRIMARY_NODE_ORDER);

export function CanvasCreateMenu({ commands }: { commands: CanvasCreateCommand[] }) {
    const theme = canvasThemes[useActiveTheme()];
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [view, setView] = useState<"main" | "more">("main");
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const projectCommands = commands.filter((command) => command.section === "project");
    const nodeCommands = commands.filter((command) => command.section === "node");
    const primaryNodeCommands = PRIMARY_NODE_ORDER.flatMap((id) =>
        nodeCommands.filter((command) => command.id === id),
    );

    const moreNodeCommands = nodeCommands.filter(
        (command) => !PRIMARY_NODE_IDS.has(command.id),
    );
    const workflowCommands = commands.filter((command) => command.section === "workflow");
    const resourceCommands = commands.filter((command) => command.section === "resource");
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    const searchResults = useMemo(() => commands.filter((command) => command.label.toLocaleLowerCase().includes(normalizedQuery)), [commands, normalizedQuery]);

    useEffect(() => {
        if (searchOpen) searchInputRef.current?.focus();
    }, [searchOpen]);

    const closeSearch = () => {
        setSearchQuery("");
        setSearchOpen(false);
    };

    return (
        <div className="flex max-h-[70vh] min-h-0 flex-col">
            <header className="flex min-h-8 shrink-0 items-center gap-2 border-b px-1 pb-2" style={{ borderColor: theme.toolbar.border }}>
                {view === "more" && !searchOpen ? (
                    <button
                        type="button"
                        className="grid size-7 shrink-0 place-items-center rounded-[var(--dock-item-radius)] outline-none transition-colors hover:bg-black/5 focus-visible:ring-2 dark:hover:bg-white/8"
                        style={{ "--tw-ring-color": theme.node.muted } as CSSProperties}
                        aria-label="返回添加节点"
                        onClick={() => setView("main")}
                    >
                        <ArrowLeft className="size-4" />
                    </button>
                ) : null}

                {searchOpen ? (
                    <label className="flex min-w-0 flex-1 items-center gap-2">
                        <Search className="size-4 shrink-0 opacity-55" aria-hidden="true" />
                        <span className="sr-only">搜索节点和资源</span>
                        <input
                            ref={searchInputRef}
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="搜索节点和资源"
                            className="h-7 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:opacity-45"
                            onKeyDown={(event) => {
                                if (event.key === "Escape") closeSearch();
                            }}
                        />
                    </label>
                ) : (
                    <h2 className="min-w-0 flex-1 truncate font-semibold leading-none" style={{ fontSize: "var(--fs-caption)" }}>
                        {view === "more" ? "更多创作" : "添加节点"}
                    </h2>
                )}

                {!searchOpen && view === "main"
                    ? projectCommands.map((command) => (
                        <button
                            key={command.id}
                            type="button"
                            className="inline-flex h-7 min-w-0 items-center gap-1 rounded-[var(--dock-item-radius)] px-1.5 font-medium outline-none transition-colors hover:bg-black/5 focus-visible:ring-2 dark:hover:bg-white/8 [&_svg]:size-3"
                            style={{ color: theme.node.muted, fontSize: "var(--fs-tiny)", "--tw-ring-color": theme.node.muted } as CSSProperties}
                            title={command.label}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={command.onClick}
                        >
                            {command.icon}
                            <span className="whitespace-nowrap">{command.label}</span>
                        </button>
                    ))
                    : null}

                <button
                    type="button"
                    className="grid size-7 shrink-0 place-items-center rounded-[var(--dock-item-radius)] outline-none transition-colors hover:bg-black/5 focus-visible:ring-2 dark:hover:bg-white/8"
                    style={{ color: theme.node.muted, "--tw-ring-color": theme.node.muted } as CSSProperties}
                    aria-label={searchOpen ? "关闭搜索" : "搜索节点和资源"}
                    aria-expanded={searchOpen}
                    onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
                >
                    {searchOpen ? <X className="size-4" /> : <Search className="size-4" />}
                </button>
            </header>

            <div className="min-h-0 overflow-y-auto overscroll-contain pt-1" data-canvas-wheel-scroll>
                {searchOpen ? (
                    <SearchResults commands={normalizedQuery ? searchResults : commands} empty={Boolean(normalizedQuery) && searchResults.length === 0} />
                ) : view === "more" ? (
                    <CommandList commands={moreNodeCommands} />
                ) : (
                    <>
                        <CommandList commands={primaryNodeCommands} />

                        {moreNodeCommands.length ? <MenuNavigationButton icon={<Shapes />} label="更多创作" detail={`${moreNodeCommands.length} 项`} onClick={() => setView("more")} /> : null}

                        {workflowCommands.length ? (
                            <>
                                <MenuSection title="工作流" color={theme.node.muted} />
                                <CommandList commands={workflowCommands} />
                            </>
                        ) : null}

                        {resourceCommands.length ? (
                            <>
                                <MenuSection title="添加资源" color={theme.node.muted} />
                                <CommandList commands={resourceCommands} />
                            </>
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
}

function SearchResults({ commands, empty }: { commands: CanvasCreateCommand[]; empty: boolean }) {
    const theme = canvasThemes[useActiveTheme()];

    if (empty) {
        return (
            <div className="px-3 py-8 text-center text-xs" style={{ color: theme.node.muted }}>
                没有匹配的节点或资源
            </div>
        );
    }

    return <CommandList commands={commands} />;
}

function CommandList({ commands }: { commands: CanvasCreateCommand[] }) {
    const theme = canvasThemes[useActiveTheme()];
    const reducedMotion = useReducedMotion();

    return (
        <div className="space-y-0.5">
            {commands.map((command) => (
                <motion.button
                    key={command.id}
                    type="button"
                    whileTap={reducedMotion ? undefined : { scale: 0.985 }}
                    transition={aceternityMotion.spring.dock}
                    className="group flex min-h-10 w-full min-w-0 items-center gap-2.5 rounded-[var(--dock-item-radius)] px-2 text-left outline-none transition-colors hover:bg-black/5 focus-visible:ring-2 dark:hover:bg-white/8"
                    style={{ color: theme.node.text, "--tw-ring-color": theme.node.muted } as CSSProperties}
                    title={command.label}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={command.onClick}
                >
                    <span className="grid size-7 shrink-0 place-items-center opacity-70 transition-opacity group-hover:opacity-100 [&_svg]:size-[18px]">{command.icon}</span>
                    <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-medium" style={{ fontSize: "var(--fs-label)" }}>
                        {command.label}
                    </span>
                    {command.badge ? (
                        <span className="shrink-0 rounded-md border px-1.5 py-0.5 font-medium leading-none" style={{ background: theme.toolbar.activeBg, borderColor: theme.toolbar.border, color: theme.node.muted, fontSize: "var(--fs-tiny)" }}>
                            {command.badge}
                        </span>
                    ) : null}
                </motion.button>
            ))}
        </div>
    );
}

function MenuNavigationButton({ icon, label, detail, onClick }: { icon: ReactNode; label: string; detail: string; onClick: () => void }) {
    const theme = canvasThemes[useActiveTheme()];

    return (
        <button
            type="button"
            className="group flex min-h-10 w-full items-center gap-2.5 rounded-[var(--dock-item-radius)] px-2 text-left outline-none transition-colors hover:bg-black/5 focus-visible:ring-2 dark:hover:bg-white/8"
            style={{ color: theme.node.text, "--tw-ring-color": theme.node.muted } as CSSProperties}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={onClick}
        >
            <span className="grid size-7 shrink-0 place-items-center opacity-70 transition-opacity group-hover:opacity-100 [&_svg]:size-[18px]">{icon}</span>
            <span className="min-w-0 flex-1 truncate font-medium" style={{ fontSize: "var(--fs-label)" }}>
                {label}
            </span>
            <span className="shrink-0 text-[var(--fs-tiny)]" style={{ color: theme.node.muted }}>
                {detail}
            </span>
            <ChevronRight className="size-4 shrink-0 opacity-45" />
        </button>
    );
}

function MenuSection({ title, color }: { title: string; color: string }) {
    return (
        <h3 className="mb-0.5 mt-2.5 px-2 font-medium leading-none" style={{ color, fontSize: "var(--fs-tiny)" }}>
            {title}
        </h3>
    );
}
