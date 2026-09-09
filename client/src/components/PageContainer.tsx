import { ReactNode, useContext, useState } from "react";

// components
import { AdminView, AdminIconButton, Loading } from "@/components";

// context
import { GlobalStateContext } from "@context/GlobalContext";

export const PageContainer = ({
  children,
  isLoading,
}: {
  children: ReactNode;
  isLoading: boolean;
  headerText?: string;
}) => {
  const { error, visitor } = useContext(GlobalStateContext);
  const [showSettings, setShowSettings] = useState(false);

  if (isLoading) return <Loading />;

  return (
    <div className={`relative min-h-screen font-body ${showSettings ? "bg-admin" : "bg-home"}`}>
      <div className="relative z-10 max-w-lg mx-auto px-4 py-6 pb-28">
        {visitor?.isAdmin && (
          <div>
            <AdminIconButton setShowSettings={() => setShowSettings(!showSettings)} showSettings={showSettings} />
          </div>
        )}

        {showSettings ? <AdminView /> : <div className="stagger-children">{children}</div>}

        {error && error !== "" && <div className="error-toast mt-6 text-center">{error}</div>}
      </div>
    </div>
  );
};

export default PageContainer;
