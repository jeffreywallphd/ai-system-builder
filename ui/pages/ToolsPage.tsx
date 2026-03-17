import { useEffect, useState } from "react";
import ToolBrowser from "../components/tools/ToolBrowser";
import { useUiDependencies } from "../composition/AppProviders";

export default function ToolsPage(): JSX.Element {
  const { toolStore } = useUiDependencies();
  const [state, setState] = useState(toolStore.getState());
  useEffect(() => toolStore.subscribe(setState), [toolStore]);
  useEffect(() => { void toolStore.refreshTools(); }, [toolStore]);

  return <section className="ui-page"><h1 className="ui-page__title">Tools</h1><p className="ui-page__subtitle">Use published tools without editing workflows.</p><ToolBrowser tools={state.tools} /></section>;
}
