const defsFixture = (slot, label, rawLua, expected = {}) => Object.freeze({
  id: `sanitized-defs-${slot}`,
  kind: 'defs',
  label,
  originalFieldName: `tweakdefs${slot}`,
  stage: 'before-editor',
  order: slot - 1,
  enabled: true,
  converted: false,
  requirements: [],
  rawLua: rawLua.trim(),
  expected,
});

const unitsFixture = (slot, label, rawLua, expected = {}) => Object.freeze({
  id: `sanitized-units-${slot}`,
  kind: 'units',
  label,
  originalFieldName: `tweakunits${slot}`,
  stage: 'after-editor',
  order: slot - 1,
  enabled: true,
  converted: false,
  requirements: [],
  rawLua: rawLua.trim(),
  expected,
});

export const SANITIZED_REFERENCE_POLICY = Object.freeze({
  version: 1,
  namespace: 'editp_fixture_',
  origin: 'Synthetic regression material derived from structural patterns only.',
  sourceCodeCopied: false,
  maximumDefsSlots: 9,
  maximumUnitsSlots: 9,
});

export const SANITIZED_REFERENCE_FIXTURES = Object.freeze({
  defs: Object.freeze([
    defsFixture(1, 'Build-menu consumer', String.raw`
      if UnitDefs["armlab"] and type(UnitDefs["armlab"].buildoptions) == "table" then
        table.insert(UnitDefs["armlab"].buildoptions, "editp_fixture_support")
      end
      UnitDefs["editp_fixture_scout"] = table.copy(UnitDefs["armflea"], true)
      UnitDefs["editp_fixture_scout"].health = 640
      UnitDefs["editp_fixture_scout"].customparams.fixture_role = "scout"
    `, { createdUnits: ['editp_fixture_scout'], buildMenuOperations: 1 }),

    defsFixture(2, 'Dependency provider', String.raw`
      UnitDefs["editp_fixture_support"] = table.copy(UnitDefs["armck"], true)
      UnitDefs["editp_fixture_support"].name = "Fixture Support"
      UnitDefs["editp_fixture_support"].description = "Synthetic dependency provider"
      UnitDefs["editp_fixture_support"].buildoptions = {
        "armflea",
        "editp_fixture_scout",
      }
    `, { createdUnits: ['editp_fixture_support'] }),

    defsFixture(3, 'Literal registry merge', String.raw`
      local defs = UnitDefs or {}
      local payload = {
        editp_fixture_artillery = {
          name = "Fixture Artillery",
          health = 1850,
          customparams = {
            fixture_role = "artillery",
          },
          weapondefs = {
            fixture_shell = {
              range = 720,
              reloadtime = 2.4,
              areaofeffect = 64,
              damage = { default = 180 },
            },
          },
          weapons = {
            [1] = { def = "FIXTURE_SHELL", onlytargetcategory = "SURFACE" },
          },
        },
      }
      table.merge(defs, payload)
    `, { createdUnits: ['editp_fixture_artillery'], literalWeaponDefinitions: 1 }),

    defsFixture(4, 'Helper clone recipes', String.raw`
      local function makeFixtureUnit(donorId, destinationId, displayName, hitpoints)
        local result = table.copy(UnitDefs[donorId], true)
        result.name = displayName
        result.health = hitpoints
        UnitDefs[destinationId] = result
      end
      makeFixtureUnit("armfav", "editp_fixture_raider", "Fixture Raider", 980)
      makeFixtureUnit("armrock", "editp_fixture_rocket", "Fixture Rocket", 1320)
    `, { createdUnits: ['editp_fixture_raider', 'editp_fixture_rocket'], helperRecipes: 2 }),

    defsFixture(5, 'Auxiliary weapon graph', String.raw`
      UnitDefs["editp_fixture_artillery"].weapondefs["fixture_fragment"] = {
        range = 260,
        areaofeffect = 24,
        damage = { default = 30 },
      }
      UnitDefs["editp_fixture_artillery"].weapondefs["fixture_cluster"] = {
        range = 720,
        reloadtime = 3,
        damage = { default = 120 },
        customparams = {
          cluster_def = "fixture_fragment",
          cluster_number = 5,
        },
      }
    `, { supportingWeaponDefs: 2 }),

    defsFixture(6, 'Type and asset diagnostics', String.raw`
      UnitDefs["editp_fixture_scout"].health = "900"
      UnitDefs["editp_fixture_scout"].canattack = "true"
      UnitDefs["editp_fixture_scout"].objectname = "Units/editp_fixture_scout.s3o"
      UnitDefs["editp_fixture_scout"].script = "Units/editp_fixture_scout.cob"
      UnitDefs["editp_fixture_scout"].buildpic = "EDITP_FIXTURE_SCOUT.DDS"
    `, { warningCodes: ['asset-swap'], minimumTypeIssues: 2, minimumAssetReferences: 3 }),

    defsFixture(7, 'Dynamic selector', String.raw`
      for unitId in pairs(UnitDefs) do
        if unitId:match("^editp_fixture_") then
          UnitDefs[unitId].customparams = UnitDefs[unitId].customparams or {}
          UnitDefs[unitId].customparams.fixture_global_pass = true
        end
      end
    `, { warningCodes: ['global-loop', 'dynamic-id'] }),

    defsFixture(8, 'Destructive runtime warnings', String.raw`
      UnitDefs["editp_fixture_retired"] = nil
      local optionalFixture = require("editp_fixture_optional_runtime")
      if optionalFixture then
        optionalFixture(UnitDefs)
      end
    `, { warningCodes: ['deletion', 'runtime-code'] }),

    defsFixture(9, 'Computed faction factory', String.raw`
      local function installFixtureVariant(prefix)
        local donorId = prefix .. "fav"
        local destinationId = "editp_fixture_" .. prefix .. "variant"
        if UnitDefs[donorId] then
          UnitDefs[destinationId] = table.copy(UnitDefs[donorId], true)
          UnitDefs[destinationId].customparams.fixture_computed = true
        end
      end
      for _, prefix in ipairs({ "arm", "cor" }) do
        installFixtureVariant(prefix)
      end
    `, { warningCodes: ['dynamic-id'] }),
  ]),

  units: Object.freeze([
    unitsFixture(1, 'Economy patch', String.raw`
      {
        editp_fixture_scout = {
          health = 680,
          metalcost = 95,
          energycost = 1250,
          buildtime = 2100,
        },
      }
    `, { literalUnitTables: 1 }),

    unitsFixture(2, 'Movement patch', String.raw`
      {
        editp_fixture_raider = {
          maxvelocity = 3.1,
          acceleration = 0.18,
          turnrate = 760,
          sightdistance = 480,
        },
      }
    `, { literalUnitTables: 1 }),

    unitsFixture(3, 'Weapon patch', String.raw`
      {
        editp_fixture_artillery = {
          weapondefs = {
            fixture_shell = {
              range = 760,
              reloadtime = 2.1,
              damage = { default = 210 },
            },
          },
          weapons = {
            [1] = { def = "FIXTURE_SHELL", onlytargetcategory = "SURFACE" },
          },
        },
      }
    `, { literalUnitTables: 1, literalWeaponDefinitions: 1 }),

    unitsFixture(4, 'Carrier behavior', String.raw`
      {
        editp_fixture_carrier = {
          customparams = {
            carried_unit = "editp_fixture_drone",
            spawnrate = 8,
            maxunits = 4,
            controlradius = 540,
            enabledocking = true,
            decayrate = 0.25,
            deathdecayrate = 1,
            carrierdeaththroe = "death",
          },
        },
      }
    `, { literalUnitTables: 1 }),

    unitsFixture(5, 'Interceptor policy', String.raw`
      {
        editp_fixture_interceptor = {
          canattack = true,
          nochasecategory = "VTOL",
          weapondefs = {
            fixture_interceptor = {
              interceptor = 1,
              coverage = 900,
              range = 820,
              damage = { default = 1 },
            },
          },
          weapons = {
            [1] = { def = "FIXTURE_INTERCEPTOR", onlytargetcategory = "MISSILE" },
          },
        },
      }
    `, { literalUnitTables: 1, literalWeaponDefinitions: 1 }),

    unitsFixture(6, 'Cluster behavior', String.raw`
      {
        editp_fixture_rocket = {
          weapondefs = {
            fixture_cluster_rocket = {
              range = 640,
              damage = { default = 80 },
              customparams = {
                cluster_def = "fixture_fragment",
                cluster_number = 6,
                spawns_name = "editp_fixture_drone",
                spawns_surface = "LAND",
              },
            },
          },
          weapons = {
            [1] = { def = "FIXTURE_CLUSTER_ROCKET" },
          },
        },
      }
    `, { literalUnitTables: 1, literalWeaponDefinitions: 1 }),

    unitsFixture(7, 'Build roster', String.raw`
      {
        editp_fixture_support = {
          buildoptions = {
            "editp_fixture_scout",
            "editp_fixture_raider",
            "editp_fixture_artillery",
          },
          workertime = 140,
          builddistance = 180,
        },
      }
    `, { literalUnitTables: 1, buildMenuOperations: 1 }),

    unitsFixture(8, 'Death profile', String.raw`
      {
        editp_fixture_artillery = {
          explodeas = "mediumexplosiongeneric",
          selfdestructas = "mediumexplosiongenericselfd",
          customparams = {
            death_explosion_damage = 320,
            death_explosion_aoe = 144,
            selfd_explosion_damage = 640,
            selfd_explosion_aoe = 210,
          },
        },
      }
    `, { literalUnitTables: 1 }),

    unitsFixture(9, 'Literal type diagnostics', String.raw`
      {
        editp_fixture_support = {
          health = "2400",
          canmove = "false",
          customparams = {
            enabledocking = 1,
            fixture_unknown_flag = "inspect",
          },
        },
      }
    `, { literalUnitTables: 1, minimumTypeIssues: 3 }),
  ]),
});

export function createSanitizedReferenceModules({ enabled = true } = {}) {
  return [...SANITIZED_REFERENCE_FIXTURES.defs, ...SANITIZED_REFERENCE_FIXTURES.units]
    .map(({ expected: _expected, ...fixture }) => ({ ...fixture, enabled }));
}

export function createSanitizedLobbyBundle(encodeLobbyBase64) {
  const commands = [
    '!preset coop',
    '!bset maxunits 3000',
    '$rename BAR Editor synthetic fixture',
  ];
  [...SANITIZED_REFERENCE_FIXTURES.defs, ...SANITIZED_REFERENCE_FIXTURES.units].forEach(fixture => {
    commands.push(`!bset ${fixture.originalFieldName} ${encodeLobbyBase64(fixture.rawLua, { padding: false })}`);
  });
  return commands.join('\n');
}
