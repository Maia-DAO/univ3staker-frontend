import {
  IPosition,
  IStakedPosition,
  useGetPositionsQuery,
  useGetStakerPositionsQuery,
} from "@/types";
import { useMemo } from "react";
import { useIncentive, useIncentives } from "./incentives";
import { useIncentiveRewards } from "./stake";
import { useGraphClient, useWeb3 } from "./web3";

export const useUserIncentivePositions = (incentiveId: string) => {
  const [incentive, incentiveLoading] = useIncentive(incentiveId);
  const [positions, positionsLoading] = useUserPositions(
    incentive?.pool.id || ""
  );

  const incentiveRewards = useIncentiveRewards(
    positions?.map((p) => ({
      incentive: incentive,
      tokenId: p.tokenId,
    })) ?? []
  );

  return {
    positions: [
      positions?.map((p, i) => ({
        ...p,
        incentiveRewards:
          incentiveRewards !== undefined ? incentiveRewards[i] : 0,
        incentive,
      })),
      incentiveLoading || positionsLoading,
    ],
  } as const;
};

export const useUserPositions = (poolId?: string) => {
  const { address } = useWeb3();
  const client = useGraphClient();
  const { data: stakerData, loading: stakerLoading } =
    useGetStakerPositionsQuery({
      variables: { where: { owner: address || "" } },
      client,
    });
  const id_in = stakerData?.positions.map((p: any) => p.tokenId) || [];
  const { data, loading } = useGetPositionsQuery({
    variables: {
      where: {
        or: [
          {
            ...(poolId === undefined ? undefined : { pool: poolId }),
            owner: address || "",
          },
          { id_in },
        ],
      },
    },
  });
  const result = useMemo(() => {
    if (!data || !stakerData) return;
    const positions = data.positions
      .map((p: any) => {
        const stakerPosition = stakerData.positions.find(
          (sp) => sp.tokenId === p.id
        );

        return {
          ...stakerPosition,
          ...p,
          deposited: p.owner !== stakerPosition?.owner,
        };
      })
      .filter((p: any) => (poolId === undefined ? true : p.pool.id === poolId));
    return positions as IPosition[];
  }, [data, poolId, stakerData]);

  return [result, loading || stakerLoading] as const;
};

export const useUserStakedPositions = () => {
  const [positions, positionsLoading] = useUserPositions();
  const [incentives, incentivesLoading] = useIncentives();

  const result = useMemo(() => {
    if (!positions) return;
    const result = positions
      .map((p: any) => {
        if (!p.deposited) return;
        const id = p.stakedIncentives?.[0]?.incentive?.id;
        const incentive = incentives?.find((i: any) => i.id === id);

        if (!incentive) return { ...p, incentive: undefined };

        return { ...p, incentive };
      })
      .filter(Boolean) as IStakedPosition[];
    return result;
  }, [incentives, positions]);

  const incentiveRewards = useIncentiveRewards(
    result?.map((p) => ({
      incentive: p.incentive,
      tokenId: p.tokenId,
    })) ?? []
  );

  return [
    result?.map((p, i) => ({
      ...p,
      incentiveRewards: incentiveRewards != undefined ? incentiveRewards[i] : 0,
    })),
    positionsLoading || incentivesLoading,
  ] as const;
};
