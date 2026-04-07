import { describe, expect, it } from "bun:test";
import React, { type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createDefaultWorkflowOutputTypeRegistry } from "@application/workflow-studio/WorkflowOutputTypeRegistry";
import WorkflowOutputSelector from "../WorkflowOutputSelector";

interface ButtonElementProps {
  readonly onClick?: (event: {
    preventDefault: () => void;
    stopPropagation: () => void;
  }) => void;
}

function collectElements(node: ReactNode): ReadonlyArray<ReactElement> {
  const elements: ReactElement[] = [];
  const stack = [node];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    if (Array.isArray(current)) {
      for (const child of current) {
        stack.push(child);
      }
      continue;
    }

    if (!React.isValidElement(current)) {
      continue;
    }

    elements.push(current);

    const children = React.Children.toArray((current.props as { children?: ReactNode }).children);
    for (const child of children) {
      stack.push(child);
    }
  }

  return elements;
}

function getElementByTestId(root: ReactElement, testId: string): ReactElement {
  const element = collectElements(root).find((entry) => (
    (entry.props as { readonly ["data-testid"]?: string })["data-testid"] === testId
  ));
  if (!element) {
    throw new Error(`Expected element with test id '${testId}' to be present.`);
  }
  return element;
}

describe("WorkflowOutputSelector", () => {
  it("renders output choices from registry metadata", () => {
    const definitions = createDefaultWorkflowOutputTypeRegistry().list();
    const html = renderToStaticMarkup(
      <WorkflowOutputSelector outputTypeDefinitions={definitions} />,
    );

    expect(html).toContain("Add outputs");
    expect(html).toContain("File export");
    expect(html).toContain("Web viewer");
    expect(html).toContain("System record");
    expect(html).toContain("Prompt response chat");
    expect(html).toContain("Add all supported outputs");
  });

  it("supports single-add and multi-add callbacks", () => {
    const definitions = createDefaultWorkflowOutputTypeRegistry().list();
    const addedRequests: string[][] = [];
    const selector = WorkflowOutputSelector({
      outputTypeDefinitions: definitions,
      onAddOutputs: (destinationTypes) => {
        addedRequests.push([...destinationTypes]);
      },
    });

    const addFile = getElementByTestId(selector, "workflow-output-add-file-export") as ReactElement<ButtonElementProps>;
    addFile.props.onClick?.({
      preventDefault: () => {},
      stopPropagation: () => {},
    });

    const addAll = getElementByTestId(selector, "workflow-output-selector-add-all") as ReactElement<ButtonElementProps>;
    addAll.props.onClick?.({
      preventDefault: () => {},
      stopPropagation: () => {},
    });

    expect(addedRequests[0]).toEqual(["file-export"]);
    expect(addedRequests[1]).toEqual(["file-export", "web-viewer", "system-entry", "prompt-response-chat"]);
  });
});

