export const ADVANCED_MECHANICS_RUNTIME_FIXTURES = Object.freeze([
  Object.freeze({
    id: 'multi-type-carrier-safety',
    description: 'normalizes multi-drone lists and fills BAR carrier safety defaults',
    units: [{ id: 'editp_carrier', name: 'Runtime Carrier', isClone: false }],
    defaultsDb: {
      editp_carrier: {
        weaponSlots: [{ slot: 1, defKey: 'dronecontroller' }],
      },
    },
    tweaks: {
      editp_carrier: {
        weapon_slot_1_carried_unit: 'armdrone corvamp armflea',
        weapon_slot_1_dronetype: 'air land scout',
        weapon_slot_1_maxunits: '4 3 2',
        weapon_slot_1_startingdronecount: '1 0 1',
        weapon_slot_1_spawn_metal_cost: '20 40 10',
        weapon_slot_1_spawn_energy_cost: '300 600 100',
        weapon_slot_1_spawnrate: 3,
        weapon_slot_1_controlradius: 1200,
        weapon_slot_1_engagementrange: 850,
        weapon_slot_1_droneammo: '4',
        weapon_slot_1_manualdrones: true,
        weapon_slot_1_enabledocking: true,
        weapon_slot_1_carrierdeaththroe: 'release',
      },
    },
    runtimeUnitDefs: {
      editp_carrier: {
        weapons: [{ def: 'DRONECONTROLLER' }],
        // Deliberately sparse: the generated Units module must safely create
        // weapondefs.dronecontroller.customparams instead of assuming it exists.
      },
      armdrone: { health: 100 },
      corvamp: { health: 200 },
      armflea: { health: 50 },
    },
    expectations: {
      paths: [
        { path: 'editp_carrier.weapondefs.dronecontroller.customparams.carried_unit', equals: 'armdrone corvamp armflea' },
        { path: 'editp_carrier.weapondefs.dronecontroller.customparams.dronetype', equals: 'air land scout' },
        { path: 'editp_carrier.weapondefs.dronecontroller.customparams.maxunits', equals: '4 3 2' },
        { path: 'editp_carrier.weapondefs.dronecontroller.customparams.startingdronecount', equals: '1 0 1' },
        { path: 'editp_carrier.weapondefs.dronecontroller.customparams.metalcost', equals: '20 40 10' },
        { path: 'editp_carrier.weapondefs.dronecontroller.customparams.energycost', equals: '300 600 100' },
        { path: 'editp_carrier.weapondefs.dronecontroller.customparams.spawnrate', equals: 3 },
        { path: 'editp_carrier.weapondefs.dronecontroller.customparams.controlradius', equals: 1200 },
        { path: 'editp_carrier.weapondefs.dronecontroller.customparams.engagementrange', equals: 850 },
        { path: 'editp_carrier.weapondefs.dronecontroller.customparams.droneammo', equals: '4 4 4' },
        { path: 'editp_carrier.weapondefs.dronecontroller.customparams.manualdrones', equals: true },
        { path: 'editp_carrier.weapondefs.dronecontroller.customparams.enabledocking', equals: false },
        { path: 'editp_carrier.weapondefs.dronecontroller.customparams.dockingpieces', equals: ' , , ' },
        { path: 'editp_carrier.weapondefs.dronecontroller.customparams.carrierdeaththroe', equals: 'release' },
        {
          path: 'editp_carrier.weapondefs.dronecontroller.customparams.droneairtime',
          equals: '31536000 31536000 31536000',
        },
      ],
    },
  }),
  Object.freeze({
    id: 'spawner-cluster-interceptor',
    description: 'preserves spawner, supporting WeaponDef, and interception contracts together',
    units: [{ id: 'editp_launcher', name: 'Runtime Launcher', isClone: false }],
    defaultsDb: {
      editp_launcher: {
        weaponSlots: [{ slot: 1, defKey: 'payload' }],
      },
    },
    tweaks: {
      editp_launcher: {
        weapon_slot_1_spawns_name: 'armflea corak',
        weapon_slot_1_spawns_surface: 'LAND',
        weapon_slot_1_spawns_mode: 'sequential',
        weapon_slot_1_spawns_expire: 45,
        weapon_slot_1_spawns_ceg: 'custom:runtime-spawn',
        weapon_slot_1_spawns_stun: 2.5,
        weapon_slot_1_spawn_blocked_by_shield: true,
        weapon_slot_1_cluster_def: 'cluster_child',
        weapon_slot_1_cluster_number: 6,
        weapon_slot_1_targetable: 2,
        weapon_slot_1_interceptor: 2,
        weapon_slot_1_coverage: 1400,
        weapon_slot_1_interceptsolo: true,
        weapon_slot_1_commandfire: true,
        weapon_slot_1_onlytargetcategory: 'VTOL',
      },
    },
    supportingWeaponDefs: [{
      id: 'runtime-cluster-child',
      ownerUnitId: 'editp_launcher',
      key: 'cluster_child',
      enabled: true,
      mode: 'replace',
      definition: {
        weapontype: 'Cannon',
        range: 420,
        damage: { default: 125 },
        customparams: { cluster_number: 2 },
      },
      mountedSlots: [],
    }],
    runtimeUnitDefs: {
      editp_launcher: {
        weapons: [{ def: 'PAYLOAD', onlytargetcategory: 'SURFACE' }],
        weapondefs: {
          payload: { range: 900 },
        },
      },
      armflea: { health: 50 },
      corak: { health: 80 },
    },
    expectations: {
      paths: [
        { path: 'editp_launcher.weapondefs.payload.customparams.spawns_name', equals: 'armflea corak' },
        { path: 'editp_launcher.weapondefs.payload.customparams.spawns_surface', equals: 'LAND' },
        { path: 'editp_launcher.weapondefs.payload.customparams.spawns_mode', equals: 'sequential' },
        { path: 'editp_launcher.weapondefs.payload.customparams.spawns_expire', equals: 45 },
        { path: 'editp_launcher.weapondefs.payload.customparams.spawns_ceg', equals: 'custom:runtime-spawn' },
        { path: 'editp_launcher.weapondefs.payload.customparams.spawns_stun', equals: 2.5 },
        { path: 'editp_launcher.weapondefs.payload.customparams.spawn_blocked_by_shield', equals: true },
        { path: 'editp_launcher.weapondefs.payload.customparams.cluster_def', equals: 'cluster_child' },
        { path: 'editp_launcher.weapondefs.payload.customparams.cluster_number', equals: 6 },
        { path: 'editp_launcher.weapondefs.payload.targetable', equals: 2 },
        { path: 'editp_launcher.weapondefs.payload.interceptor', equals: 2 },
        { path: 'editp_launcher.weapondefs.payload.coverage', equals: 1400 },
        { path: 'editp_launcher.weapondefs.payload.interceptsolo', equals: true },
        { path: 'editp_launcher.weapondefs.payload.commandfire', equals: true },
        { path: 'editp_launcher.weapons.0.onlytargetcategory', equals: 'VTOL' },
        { path: 'editp_launcher.weapondefs.cluster_child.damage.default', equals: 125 },
        { path: 'editp_launcher.weapondefs.cluster_child.customparams.cluster_number', equals: 2 },
      ],
    },
  }),
  Object.freeze({
    id: 'sector-fire-horizontal-spread',
    description: 'writes the verified Tremor sector-fire contract without replacing unrelated WeaponDef custom parameters',
    units: [{ id: 'editp_inferno', name: 'Runtime Inferno', isClone: false }],
    defaultsDb: {
      editp_inferno: {
        weaponSlots: [{ slot: 1, defKey: 'rapidnapalm' }],
      },
    },
    tweaks: {
      editp_inferno: {
        weapon_slot_1_speceffect: 'sector_fire',
        weapon_slot_1_spread_angle: 22,
        weapon_slot_1_max_range_reduction: 0.3,
        weapon_slot_1_accuracy: 0,
        weapon_slot_1_sprayangle: 0,
      },
    },
    runtimeUnitDefs: {
      editp_inferno: {
        weapons: [{ def: 'RAPIDNAPALM' }],
        weapondefs: {
          rapidnapalm: {
            accuracy: 200,
            sprayangle: 1500,
            customparams: { area_onhit: 1 },
          },
        },
      },
    },
    expectations: {
      paths: [
        { path: 'editp_inferno.weapondefs.rapidnapalm.customparams.speceffect', equals: 'sector_fire' },
        { path: 'editp_inferno.weapondefs.rapidnapalm.customparams.spread_angle', equals: 22 },
        { path: 'editp_inferno.weapondefs.rapidnapalm.customparams.max_range_reduction', equals: 0.3 },
        { path: 'editp_inferno.weapondefs.rapidnapalm.customparams.area_onhit', equals: 1 },
        { path: 'editp_inferno.weapondefs.rapidnapalm.accuracy', equals: 0 },
        { path: 'editp_inferno.weapondefs.rapidnapalm.sprayangle', equals: 0 },
      ],
    },
  }),
  Object.freeze({
    id: 'nested-clone-explosion-isolation',
    description: 'keeps death and self-destruct profiles isolated on a nested clone',
    units: [
      { id: 'armflash', name: 'Flash', isClone: false },
      { id: 'editp_parent', name: 'Runtime Parent', isClone: true },
      { id: 'editp_child', name: 'Runtime Child', isClone: true },
    ],
    clones: [
      {
        baseId: 'editp_parent',
        newId: 'editp_child',
        displayName: 'Runtime Child',
        builderIds: ['armlab'],
      },
      {
        baseId: 'armflash',
        newId: 'editp_parent',
        displayName: 'Runtime Parent',
        builderIds: ['armlab'],
      },
    ],
    cloneRoots: {
      editp_parent: 'armflash',
      editp_child: 'armflash',
    },
    defaultsDb: {
      armflash: {
        explodeas: 'fusionboom',
        selfdestructas: 'fusionboomselfd',
        weaponSlots: [{ slot: 1, defKey: 'laser' }],
      },
    },
    explosionProfiles: {
      fusionboom: {
        areaofeffect: 96,
        camerashake: 24,
        impulsefactor: 0.4,
        damage: { default: 200 },
        customparams: { unitexplosion: 1 },
      },
      fusionboomselfd: {
        areaofeffect: 128,
        camerashake: 32,
        impulsefactor: 0.6,
        damage: { default: 400 },
        customparams: { unitexplosion: 1 },
      },
    },
    tweaks: {
      editp_child: {
        death_explosion_damage: 4100,
        death_explosion_aoe: 360,
        death_explosion_camerashake: 80,
        death_explosion_impulsefactor: 1.25,
        selfd_explosion_damage: 8200,
        selfd_explosion_aoe: 600,
        selfd_explosion_camerashake: 160,
        selfd_explosion_impulsefactor: 2.5,
      },
    },
    runtimeUnitDefs: {
      armflash: {
        name: 'Flash',
        buildoptions: [],
        weapons: [{ def: 'LASER' }],
        weapondefs: {
          laser: { range: 300, damage: { default: 50 } },
        },
      },
      armlab: {
        name: 'Bot Lab',
        buildoptions: ['armflash'],
      },
    },
    expectations: {
      unitsExist: ['editp_parent', 'editp_child'],
      paths: [
        { path: 'editp_child.explodeas', equals: 'editp_death' },
        { path: 'editp_child.selfdestructas', equals: 'editp_selfd' },
        { path: 'editp_child.weapondefs.editp_death.damage.default', equals: 4100 },
        { path: 'editp_child.weapondefs.editp_death.areaofeffect', equals: 360 },
        { path: 'editp_child.weapondefs.editp_death.camerashake', equals: 80 },
        { path: 'editp_child.weapondefs.editp_death.impulsefactor', equals: 1.25 },
        { path: 'editp_child.weapondefs.editp_selfd.damage.default', equals: 8200 },
        { path: 'editp_child.weapondefs.editp_selfd.areaofeffect', equals: 600 },
        { path: 'editp_child.weapondefs.editp_selfd.camerashake', equals: 160 },
        { path: 'editp_child.weapondefs.editp_selfd.impulsefactor', equals: 2.5 },
        { path: 'editp_parent.weapondefs.laser.damage.default', equals: 50 },
      ],
      buildMenus: {
        armlab: {
          includes: ['armflash', 'editp_parent', 'editp_child'],
        },
      },
    },
  }),
]);
