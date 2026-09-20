import * as React from "react";
import { useApp } from "@/lib/app-state";
import { humanizeIds, loadPeerNames, prettifyId, type PeerNames } from "@/lib/peer-names";

/**
 * Names for every peer in the current workspace, loaded once and shared.
 *
 * Screens render before the names arrive, so `nameFor` falls back to a
 * tidied id rather than blanking out and shifting the layout when the
 * real name lands.
 */
export function usePeerNames() {
  const { workspace } = useApp();
  const [names, setNames] = React.useState<PeerNames>(() => new Map());

  React.useEffect(() => {
    let live = true;
    setNames(new Map());
    void loadPeerNames(workspace).then((m) => {
      if (live) setNames(m);
    });
    return () => {
      live = false;
    };
  }, [workspace]);

  return React.useMemo(
    () => ({
      names,
      /** Their name, or the most readable form of their id. */
      nameFor: (id: string) => names.get(id) ?? prettifyId(id),
      /** Their name, or undefined — for callers that need to know. */
      knownName: (id: string) => names.get(id),
      /** Swap ids for names inside generated prose. */
      humanize: (text: string) => humanizeIds(text, (id) => names.get(id)),
    }),
    [names],
  );
}
