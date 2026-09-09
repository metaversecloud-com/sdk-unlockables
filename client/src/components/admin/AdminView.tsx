import { useState } from "react";

// components
import DropEditor from "./DropEditor";
import DropsList from "./DropsList";

/**
 * Admin navigation below the gear: drops list → drop editor.
 *
 * The gear button in PageContainer toggles between the home and this view, so stepping back
 * out to home is handled there; the editor renders its own back arrow to return to the list.
 */
type AdminRoute = { name: "list" } | { name: "editor"; dropId?: string };

export const AdminView = () => {
  const [route, setRoute] = useState<AdminRoute>({ name: "list" });

  if (route.name === "editor") {
    return (
      <DropEditor
        dropId={route.dropId}
        onBack={() => setRoute({ name: "list" })}
        onDone={() => setRoute({ name: "list" })}
      />
    );
  }

  return (
    <DropsList
      onSelectDrop={(dropId) => setRoute({ name: "editor", dropId })}
      onAddDrop={() => setRoute({ name: "editor" })}
    />
  );
};

export default AdminView;
