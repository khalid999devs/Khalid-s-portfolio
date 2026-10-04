/* eslint-disable react/no-unknown-property */
import { forwardRef, use, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import gsap from 'gsap';
import { loadModel } from './modelSource';
import { flight } from './flight';

// How far the bot leans for its speed, in radians per px/s, and the most it may.
const ROLL = 0.0006;
const YAW = 0.0005;
const PITCH = 0.0004;
const MOST_LEAN = 0.42;
// Its wings beat up to this much faster at full speed.
const FASTEST_BEAT = 2.2;
const FULL_SPEED = 1400;

const lean = (speed, factor) =>
  Math.min(Math.max(speed * factor, -MOST_LEAN), MOST_LEAN);

const Model = forwardRef((props) => {
  const group = useRef();
  const body = useRef();
  const { nodes, materials, animations } = useGLTF(use(loadModel()));
  const beat = useRef(null);
  const { actions } = useAnimations(animations, group);

  // Banks into the direction it flies, as something with wings does.
  useFrame((_, delta) => {
    const { rotation } = body.current;
    const { vx, vy } = flight;
    const moving = vx !== 0 || vy !== 0;
    if (!moving && !rotation.x && !rotation.y && !rotation.z) return;

    const ease = 1 - Math.exp(-9 * delta);
    rotation.x += (lean(vy, PITCH) - rotation.x) * ease;
    rotation.y += (lean(vx, YAW) - rotation.y) * ease;
    rotation.z += (lean(-vx, ROLL) - rotation.z) * ease;
    let pace =
      1 + (FASTEST_BEAT - 1) * Math.min(Math.hypot(vx, vy) / FULL_SPEED, 1);

    // Upright again, exactly, once it has landed.
    const tilt = Math.abs(rotation.x) + Math.abs(rotation.y) + Math.abs(rotation.z);
    if (!moving && tilt < 0.002) {
      rotation.set(0, 0, 0);
      pace = 1;
    }
    if (beat.current) beat.current.timeScale = pace;
  });

  useEffect(() => {
    if (actions && animations.length > 0) {
      const action = actions[Object.keys(actions)[0]];
      if (action) {
        action.play();
        beat.current = action;
      }
    }
  }, [actions, animations]);

  useEffect(() => {
    if (group.current) {
      gsap.fromTo(
        group.current.scale,
        { x: 0, y: 0, z: 0 },
        { x: 300, y: 300, z: 300, duration: 1.5, ease: 'power2.out' }
      );
    }
  }, []);

  return (
    <group ref={body}>
      <group ref={group} {...props} scale={1} dispose={null}>
        <group name='Sketchfab_Scene'>
          <group name='Sketchfab_model' rotation={[-Math.PI / 2, 0, 0]}>
            <group
              name='9720a92d3b9a4d279bb7067fb9d66a02fbx'
              rotation={[Math.PI / 2, 0, 0]}
              scale={0.01}
            >
              <group name='Object_2'>
                <group name='RootNode'>
                  <group name='Geo'>
                    <group name='Body' position={[0, -0.195, 0]}>
                      <mesh
                        name='Body_mat_michi_0'
                        castShadow
                        receiveShadow
                        geometry={nodes.Body_mat_michi_0.geometry}
                        material={materials.mat_michi}
                      />
                      <group name='AlaSup_Low1' position={[0.627, 0.389, 0]}>
                        <group
                          name='Wing_Up_I'
                          position={[-0.627, -0.427, 0]}
                          rotation={[0, 0.436, 0]}
                        >
                          <group
                            name='Wing_Up_I_1'
                            position={[0.515, 0.296, -0.012]}
                          >
                            <mesh
                              name='Wing_Up_I_mat_michi_0'
                              castShadow
                              receiveShadow
                              geometry={nodes.Wing_Up_I_mat_michi_0.geometry}
                              material={materials.mat_michi}
                            />
                          </group>
                        </group>
                        <group
                          name='Wing_Up_D'
                          position={[-0.627, -0.427, 0]}
                          rotation={[0, -0.436, 0]}
                        >
                          <group
                            name='Wing_Up_D_1'
                            position={[-0.515, 0.296, -0.012]}
                          >
                            <mesh
                              name='Wing_Up_D_mat_michi_0'
                              castShadow
                              receiveShadow
                              geometry={nodes.Wing_Up_D_mat_michi_0.geometry}
                              material={materials.mat_michi}
                            />
                          </group>
                        </group>
                      </group>
                      <group name='Wing' position={[0.675, 0.203, 0]}>
                        <group
                          name='Wing_Down_I'
                          position={[-0.675, -0.241, 0]}
                          rotation={[0, 0.436, 0]}
                        >
                          <group
                            name='Wing_Down_I_1'
                            position={[0.589, 0.199, -0.012]}
                          >
                            <mesh
                              name='Wing_Down_I_mat_michi_0'
                              castShadow
                              receiveShadow
                              geometry={nodes.Wing_Down_I_mat_michi_0.geometry}
                              material={materials.mat_michi}
                            />
                          </group>
                        </group>
                        <group
                          name='Wing_Down_D'
                          position={[-0.675, -0.241, 0]}
                          rotation={[0, -0.436, 0]}
                        >
                          <group
                            name='Wing_Down_D_1'
                            position={[-0.589, 0.199, -0.012]}
                            rotation={[-0.122, -0.592, -0.068]}
                          >
                            <mesh
                              name='Wing_Down_D_mat_michi_0'
                              castShadow
                              receiveShadow
                              geometry={nodes.Wing_Down_D_mat_michi_0.geometry}
                              material={materials.mat_michi}
                            />
                          </group>
                        </group>
                      </group>
                      <group name='Shoulder' position={[0, 0.395, 0]}>
                        <group
                          name='Shoulder_I'
                          position={[0.394, -0.308, 0.056]}
                          rotation={[-0.857, 0.002, -0.004]}
                        >
                          <mesh
                            name='Shoulder_I_mat_michi_0'
                            castShadow
                            receiveShadow
                            geometry={nodes.Shoulder_I_mat_michi_0.geometry}
                            material={materials.mat_michi}
                          />
                          <group
                            name='Cannon_I'
                            position={[0.058, 0.001, 0.052]}
                            rotation={[-0.009, 0.131, 0.151]}
                          >
                            <mesh
                              name='Cannon_I_mat_michi_0'
                              castShadow
                              receiveShadow
                              geometry={nodes.Cannon_I_mat_michi_0.geometry}
                              material={materials.mat_michi}
                            />
                          </group>
                        </group>
                        <group
                          name='Shoulder_D'
                          position={[-0.394, -0.308, 0.056]}
                          rotation={[-0.672, 0.275, 0.13]}
                        >
                          <mesh
                            name='Shoulder_D_mat_michi_0'
                            castShadow
                            receiveShadow
                            geometry={nodes.Shoulder_D_mat_michi_0.geometry}
                            material={materials.mat_michi}
                          />
                          <group
                            name='Cannon_D'
                            position={[0.394, 0.308, -0.056]}
                          >
                            <mesh
                              name='Cannon_D_mat_michi_0'
                              castShadow
                              receiveShadow
                              geometry={nodes.Cannon_D_mat_michi_0.geometry}
                              material={materials.mat_michi}
                            />
                          </group>
                        </group>
                      </group>
                      <group name='Cannon' position={[0, 0.395, 0]} />
                      <group
                        name='Head'
                        position={[0, 0.306, 0.088]}
                        rotation={[0, Math.PI / 9, 0]}
                      >
                        <mesh
                          name='Head_mat_michi_0'
                          castShadow
                          receiveShadow
                          geometry={nodes.Head_mat_michi_0.geometry}
                          material={materials.mat_michi}
                        />
                        <group name='Head_Prop' position={[0, 0.089, -0.088]}>
                          <mesh
                            name='Head_Prop_mat_michi_0'
                            castShadow
                            receiveShadow
                            geometry={nodes.Head_Prop_mat_michi_0.geometry}
                            material={materials.mat_michi}
                          />
                        </group>
                      </group>
                    </group>
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
});

Model.displayName = 'Model';

// Parsed ahead of the canvas mounting; a failure surfaces when Model renders.
loadModel()
  .then((url) => useGLTF.preload(url))
  .catch(() => {});

export default Model;
