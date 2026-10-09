import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Plus } from "lucide-react";
import { InputNumber } from "antd";

import { IconButton } from "../src/components/ui/base/buttons";
import { Tooltip } from "../src/components/ui/base/tooltip";

test("InputNumber tooltip anchors on an element rather than its imperative ref", () => {
    const input = <InputNumber value={1} aria-label="数量" />;
    const tree = Tooltip({ title: "数量", children: input });
    const focusable = tree.props.children[0].props.children;
    expect(focusable.props.excludeFromTabOrder).toBe(true);
    expect(focusable.props.children.type).toBe("span");
    expect(focusable.props.children.props.children).toBe(input);
    const markup = renderToStaticMarkup(tree);
    expect(markup).toContain('aria-label="数量"');
    expect(markup).not.toMatch(/<span[^>]*tabindex="0"/);
});

test("tooltip gives native and custom controls one real focus target", () => {
    for (const child of [<button aria-label="新增">+</button>, <IconButton icon={Plus} aria-label="新增" />]) {
        const markup = renderToStaticMarkup(<Tooltip title="新增节点">{child}</Tooltip>);
        expect(markup).toMatch(/<button[^>]*tabindex="0"/);
        expect(markup).not.toMatch(/<span[^>]*tabindex=/);
    }
});

test("tooltip preserves explicit tab order and disabled controls", () => {
    const excluded = renderToStaticMarkup(
        <Tooltip title="说明">
            <button tabIndex={-1}>操作</button>
        </Tooltip>,
    );
    expect(excluded).toMatch(/<button[^>]*tabindex="-1"/);
    const disabled = renderToStaticMarkup(
        <Tooltip title="不可操作">
            <button disabled>操作</button>
        </Tooltip>,
    );
    expect(disabled).toMatch(/<button[^>]*disabled/);
    expect(disabled).not.toContain('tabindex="0"');
});
