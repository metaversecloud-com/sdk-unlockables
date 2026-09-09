import { useContext, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

// components
import { ChallengeCard, EmptyState, PageContainer, RecentDropsStrip, SuccessCard, UpcomingStrip } from "@/components";

// context
import { GlobalDispatchContext, GlobalStateContext } from "@/context/GlobalContext";
import { ErrorType, SessionUnlock, SET_VISITOR } from "@/context/types";

// utils
import { addSessionUnlock, backendAPI, setErrorMessage, setGameState } from "@/utils";

const Home = () => {
  const dispatch = useContext(GlobalDispatchContext);
  const { gameState, hasInteractiveParams, hasSetupBackend, unlockedThisSession } = useContext(GlobalStateContext);

  const [searchParams] = useSearchParams();
  const forceRefreshInventory = searchParams.get("forceRefreshInventory") === "true";

  const [isLoading, setIsLoading] = useState(true);

  const upcoming = gameState?.upcoming || [];
  const recentDrops = gameState?.recentDrops || [];
  const active = gameState?.active || [];

  const handleUnlocked = (sessionUnlock: SessionUnlock) => addSessionUnlock(dispatch, sessionUnlock);

  useEffect(() => {
    if (!hasInteractiveParams) return;

    backendAPI
      .get("/game-state", { params: { forceRefreshInventory } })
      .then((response) => {
        const { upcoming, recentDrops, active, timezone, today, isAdmin } = response.data;
        setGameState(dispatch, { upcoming, recentDrops, active, timezone, today });

        dispatch!({ type: SET_VISITOR, payload: { visitor: { isAdmin } } });
      })
      .catch((error) => setErrorMessage(dispatch, error as ErrorType))
      .finally(() => setIsLoading(false));
  }, [hasInteractiveParams, dispatch, forceRefreshInventory]);

  if (!hasSetupBackend) return <div />;

  return (
    <PageContainer isLoading={isLoading}>
      <h2 className="text-center text-2xl mb-5">Unlock Challenges</h2>

      <div className="flex flex-col gap-5">
        <UpcomingStrip drops={upcoming} />
        <RecentDropsStrip drops={recentDrops} />

        {active.length === 0 ? (
          <EmptyState />
        ) : (
          active.map((drop) => {
            const sessionUnlock = unlockedThisSession?.[drop.id];

            return drop.claimed || sessionUnlock ? (
              <SuccessCard key={drop.id} drop={drop} sessionUnlock={sessionUnlock} />
            ) : (
              <ChallengeCard key={drop.id} drop={drop} onUnlocked={handleUnlocked} />
            );
          })
        )}
      </div>
    </PageContainer>
  );
};

export default Home;
