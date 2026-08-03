import { Button, Result, Spin } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DEMO_PROJECT_ID } from '../../domain/constants';
import { StoryCanvasApp } from '../../features/storycanvas/StoryCanvasApp';
import { useControlPlaneStore } from '../../stores/controlPlaneStore';

export function IntegratedStoryCanvasPage() {
  const { projectId } = useParams<{ projectId?: string }>();
  const [preparing, setPreparing] = useState(true);
  const initialDispatchPromise = useRef<Promise<unknown> | null>(null);
  const snapshot = useControlPlaneStore((state) => state.snapshot);
  const error = useControlPlaneStore((state) => state.error);
  const dispatchCanonicalPackage = useControlPlaneStore(
    (state) => state.dispatchCanonicalPackage,
  );
  const grant = snapshot.grants[0];

  useEffect(() => {
    let active = true;
    if (projectId !== DEMO_PROJECT_ID) {
      setPreparing(false);
      return () => {
        active = false;
      };
    }
    if (!initialDispatchPromise.current) {
      initialDispatchPromise.current = dispatchCanonicalPackage();
    }

    void initialDispatchPromise.current.finally(() => {
      if (active) setPreparing(false);
    });
    return () => {
      active = false;
    };
  }, [dispatchCanonicalPackage, projectId]);

  if (projectId !== DEMO_PROJECT_ID) {
    return (
      <Result
        status="403"
        title="ROUTE_ID_REJECTED"
        subTitle={`StoryCanvas 仅接受 canonical Demo 项目 ${DEMO_PROJECT_ID}。`}
      />
    );
  }

  if (preparing) {
    return (
      <div className="storycanvas-host">
        <Spin fullscreen={false} tip="正在下发生产包并签发项目授权..." />
      </div>
    );
  }

  if (!grant) {
    return (
      <Result
        status="error"
        title="生产授权准备失败"
        subTitle={error?.message ?? '未取得当前项目的内存 grant。'}
        extra={
          <Button
            type="primary"
            onClick={() => {
              setPreparing(true);
              void dispatchCanonicalPackage().finally(() => setPreparing(false));
            }}
          >
            重新准备
          </Button>
        }
      />
    );
  }

  return (
    <div className="storycanvas-host">
      <StoryCanvasApp grant={grant} />
    </div>
  );
}
