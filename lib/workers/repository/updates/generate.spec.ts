import { defaultConfig, partial } from '../../../../test/util';
import type { UpdateType } from '../../../config/types';
import { NpmDatasource } from '../../../modules/datasource/npm';
import type { LookupUpdate } from '../../../modules/manager/types';
import type { BranchUpgradeConfig } from '../../types';
import { generateBranchConfig } from './generate';

beforeEach(() => {
  jest.resetAllMocks();
});

describe('workers/repository/updates/generate', () => {
  describe('generateBranchConfig()', () => {
    it('does not group single upgrade', () => {
      const branch = [
        {
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          releaseTimestamp: '2017-02-07T20:01:41+00:00',
          foo: 1,
          group: {
            foo: 2,
          },
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(1);
      expect(res.groupName).toBeUndefined();
      expect(res.releaseTimestamp).toBeDefined();
    });

    it('handles lockFileMaintenance', () => {
      const branch = [
        {
          manager: 'some-manager',
          branchName: 'some-branch',
          prTitle: 'some-title',
          isLockFileMaintenance: true,
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res).toMatchSnapshot({
        branchName: 'some-branch',
        prTitle: 'some-title',
        isLockFileMaintenance: true,
        upgrades: [
          {
            branchName: 'some-branch',
            prTitle: 'some-title',
            isLockFileMaintenance: true,
          },
        ],
      });
    });

    it('handles lockFileUpdate', () => {
      const branch = [
        {
          manager: 'some-manager',
          branchName: 'some-branch',
          prTitle: 'some-title',
          isLockfileUpdate: true,
          currentValue: '^1.0.0',
          currentVersion: '1.0.0',
          lockedVersion: '1.0.0',
          newValue: '^1.0.0',
          newVersion: '1.0.1',
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res).toMatchSnapshot({
        branchName: 'some-branch',
        prTitle: 'some-title',
        isLockfileUpdate: true,
        currentValue: '^1.0.0',
        currentVersion: '1.0.0',
        lockedVersion: '1.0.0',
        newValue: '^1.0.0',
        newVersion: '1.0.1',
        reuseLockFiles: true,
        upgrades: [
          {
            branchName: 'some-branch',
            prTitle: 'some-title',
            isLockfileUpdate: true,
            currentValue: '^1.0.0',
            currentVersion: '1.0.0',
            lockedVersion: '1.0.0',
            newValue: '^1.0.0',
            newVersion: '1.0.1',
          },
        ],
      });
    });

    it('does not group same upgrades', () => {
      const branch = [
        {
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          foo: 1,
          group: {
            foo: 2,
          },
        },
        {
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          foo: 1,
          group: {
            foo: 2,
          },
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(1);
      expect(res.groupName).toBeUndefined();
    });

    it('groups multiple upgrades same version', () => {
      const branch = [
        {
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}v{{newMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          foo: 1,
          newValue: '5.1.2',
          newVersion: '5.1.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-07T20:01:41+00:00',
          automerge: true,
          constraints: {
            foo: '1.0.0',
          },
        },
        {
          manager: 'some-manager',
          depName: 'some-other-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}v{{newMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          foo: 1,
          newValue: '5.1.2',
          newVersion: '5.1.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-06T20:01:41+00:00',
          automerge: false,
          constraints: {
            foo: '1.0.0',
            bar: '2.0.0',
          },
        },
        {
          manager: 'some-manager',
          depName: 'another-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}v{{newMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          foo: 1,
          newValue: '5.1.2',
          newVersion: '5.1.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-06T20:01:41+00:00',
          automerge: false,
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(2);
      expect(res.groupName).toBeDefined();
      expect(res.releaseTimestamp).toBe('2017-02-07T20:01:41+00:00');
      expect(res.automerge).toBeFalse();
      expect(res.constraints).toEqual({
        foo: '1.0.0',
        bar: '2.0.0',
      });
    });

    it('groups major updates with different versions but same newValue, no recreateClosed', () => {
      const branch = [
        {
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}v{{newMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          foo: 1,
          newValue: '5.1.2',
          newVersion: '5.1.2',
          isMajor: true,
          newMajor: 5,
        },
        {
          manager: 'some-manager',
          depName: 'some-other-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}v{{newMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          foo: 1,
          newValue: '5.2.0',
          newVersion: '5.2.0',
          isMajor: true,
          newMajor: 5,
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.groupName).toBeDefined();
      expect(res.recreateClosed).toBeFalsy();
    });

    it('groups multiple upgrades different version', () => {
      const branch = [
        {
          manager: 'some-manager',
          depName: 'depB',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}v{{newMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          foo: 1,
          newValue: '5.1.2',
          newVersion: '5.1.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-07T20:01:41+00:00',
        },
        {
          manager: 'some-manager',
          depName: 'depA',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}v{{newMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          foo: 1,
          newValue: '1.1.0',
          newVersion: '1.1.0',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-08T20:01:41+00:00',
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(2);
      expect(res.singleVersion).toBeUndefined();
      expect(res.recreateClosed).toBeTrue();
      expect(res.groupName).toBeDefined();
      expect(res.releaseTimestamp).toBe('2017-02-08T20:01:41+00:00');
    });

    it('groups multiple upgrades different version but same value', () => {
      const branch = [
        {
          manager: 'some-manager',
          depName: 'depB',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}v{{newMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          foo: 1,
          newValue: '^6.0',
          newVersion: '6.0.3',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-07T20:01:41+00:00',
        },
        {
          manager: 'some-manager',
          depName: 'depA',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}v{{newMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          foo: 1,
          newValue: '^6.0',
          newVersion: '6.0.1',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-08T20:01:41+00:00',
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(2);
      expect(res.singleVersion).toBeUndefined();
      expect(res.recreateClosed).toBeUndefined();
      expect(res.groupName).toBeDefined();
      expect(res.releaseTimestamp).toBe('2017-02-08T20:01:41+00:00');
    });

    it('groups multiple upgrades different value but same version', () => {
      const branch = [
        {
          manager: 'some-manager',
          depName: 'depB',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}v{{newMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          foo: 1,
          newValue: '^6.0.1',
          newVersion: '6.0.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-07T20:01:41+00:00',
        },
        {
          manager: 'some-manager',
          depName: 'depA',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}v{{newMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          foo: 1,
          newValue: '^6.0.0',
          newVersion: '6.0.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-08T20:01:41+00:00',
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(2);
      expect(res.singleVersion).toBeUndefined();
      expect(res.recreateClosed).toBeUndefined();
      expect(res.groupName).toBeDefined();
      expect(res.releaseTimestamp).toBe('2017-02-08T20:01:41+00:00');
    });

    it('groups multiple digest updates', () => {
      const branch = [
        {
          manager: 'some-manager',
          depName: 'foo/bar',
          groupName: 'foo docker images',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}v{{newMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          isDigest: true,
          currentDigest: 'abcdefghijklmnopqrstuvwxyz',
          newDigest: '123abcdefghijklmnopqrstuvwxyz',
          foo: 1,
          group: {
            foo: 2,
          },
        },
        {
          manager: 'some-manager',
          depName: 'foo/baz',
          groupName: 'foo docker images',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}v{{newMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          foo: 1,
          newValue: 'zzzzzzzzzz',
          group: {
            foo: 2,
          },
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(2);
      expect(res.singleVersion).toBeUndefined();
      expect(res.recreateClosed).toBeTrue();
      expect(res.groupName).toBeDefined();
    });

    it('pins digest to table', () => {
      const branch = [
        partial<LookupUpdate & BranchUpgradeConfig>({
          ...defaultConfig,
          depName: 'foo-image',
          newDigest: 'abcdefg987612345',
          currentDigest: '',
          updateType: 'pinDigest',
          isPinDigest: true,
        }),
      ];
      const res = generateBranchConfig(branch);
      expect(res.upgrades[0].displayFrom).toBe('');
      expect(res.upgrades[0].displayTo).toBe('abcdefg');
    });

    it('fixes different messages', () => {
      const branch = [
        {
          manager: 'some-manager',
          depName: 'depA',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}v{{newMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          foo: 1,
          newValue: '>= 5.1.2',
          newVersion: '5.1.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-07T20:01:41+00:00',
        },
        {
          manager: 'some-manager',
          depName: 'depA',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          commitMessageExtra:
            'to {{#if isMajor}}v{{newMajor}}{{else}}{{#unless isRange}}v{{/unless}}{{newValue}}{{/if}}',
          foo: 1,
          newValue: '^5,1,2',
          newVersion: '5.1.2',
          group: {
            foo: 2,
          },
          releaseTimestamp: '2017-02-08T20:01:41+00:00',
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.foo).toBe(1);
      expect(res.groupName).toBeUndefined();
    });

    it('uses semantic commits', () => {
      const branch = [
        partial<BranchUpgradeConfig>({
          ...defaultConfig,
          manager: 'some-manager',
          depName: 'some-dep',
          semanticCommits: 'enabled',
          semanticCommitType: 'chore',
          semanticCommitScope: 'package',
          newValue: '1.2.0',
          isSingleVersion: true,
          newVersion: '1.2.0',
          foo: 1,
          group: {
            foo: 2,
          },
        }),
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe(
        'chore(package): update dependency some-dep to v1.2.0'
      );
    });

    it('scopes monorepo commits', () => {
      const branch = [
        partial<BranchUpgradeConfig>({
          ...defaultConfig,
          manager: 'some-manager',
          depName: 'some-dep',
          packageFile: 'package.json',
          baseDir: '',
          semanticCommits: 'enabled',
          semanticCommitType: 'chore',
          semanticCommitScope: '{{baseDir}}',
          newValue: '1.2.0',
          isSingleVersion: true,
          newVersion: '1.2.0',
          foo: 1,
          group: {
            foo: 2,
          },
        }),
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe('chore(): update dependency some-dep to v1.2.0');
    });

    it('scopes monorepo commits with nested package files using parent directory', () => {
      const branch = [
        partial<BranchUpgradeConfig>({
          ...defaultConfig,
          commitBodyTable: false,
          manager: 'some-manager',
          depName: 'some-dep',
          packageFile: 'foo/bar/package.json',
          parentDir: 'bar',
          semanticCommits: 'enabled',
          semanticCommitType: 'chore',
          semanticCommitScope: '{{parentDir}}',
          newValue: '1.2.0',
          isSingleVersion: true,
          newVersion: '1.2.0',
          foo: 1,
          group: {
            foo: 2,
          },
        }),
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe(
        'chore(bar): update dependency some-dep to v1.2.0'
      );
    });

    it('scopes monorepo commits with nested package files using base directory', () => {
      const branch = [
        partial<BranchUpgradeConfig>({
          ...defaultConfig,
          manager: 'some-manager',
          depName: 'some-dep',
          packageFile: 'foo/bar/package.json',
          packageFileDir: 'foo/bar',
          semanticCommits: 'enabled',
          semanticCommitType: 'chore',
          semanticCommitScope: '{{packageFileDir}}',
          newValue: '1.2.0',
          isSingleVersion: true,
          newVersion: '1.2.0',
          foo: 1,
          group: {
            foo: 2,
          },
        }),
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe(
        'chore(foo/bar): update dependency some-dep to v1.2.0'
      );
    });

    it('adds commit message body', () => {
      const branch = [
        partial<BranchUpgradeConfig>({
          ...defaultConfig,
          manager: 'some-manager',
          depName: 'some-dep',
          commitBody: '[skip-ci]',
          newValue: '1.2.0',
          isSingleVersion: true,
          newVersion: '1.2.0',
        }),
      ];
      const res = generateBranchConfig(branch);
      expect(res.commitMessage).toMatchSnapshot();
      expect(res.commitMessage).toContain('\n');
    });

    it('supports manual prTitle', () => {
      const branch = [
        partial<BranchUpgradeConfig>({
          ...defaultConfig,
          manager: 'some-manager',
          depName: 'some-dep',
          prTitle: 'Upgrade {{depName}}',
          toLowerCase: true,
        }),
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toBe('upgrade some-dep');
    });

    it('handles @types specially', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
          commitBodyTable: true,
          datasource: NpmDatasource.id,
          depName: '@types/some-dep',
          groupName: null,
          branchName: 'some-branch',
          prTitle: 'some-title',
          currentValue: '0.5.7',
          currentVersion: '0.5.7',
          newValue: '0.5.8',
          newVersion: '0.5.8',
          group: {},
        },
        {
          commitBodyTable: true,
          datasource: NpmDatasource.id,
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: null,
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          group: {},
        },
        {
          commitBodyTable: true,
          datasource: NpmDatasource.id,
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: null,
          branchName: 'some-branch',
          prTitle: 'some-other-title',
          newValue: '1.0.0',
          group: {},
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.recreateClosed).toBeFalse();
      expect(res.groupName).toBeUndefined();
      expect(generateBranchConfig(branch)).toMatchSnapshot({
        upgrades: [
          {
            manager: 'some-manager',
            depName: 'some-dep',
            branchName: 'some-branch',
            newValue: '0.6.0',
          },
          {
            manager: 'some-manager',
            depName: 'some-dep',
            branchName: 'some-branch',
            newValue: '1.0.0',
          },
          {
            depName: '@types/some-dep',
            branchName: 'some-branch',
            newValue: '0.5.8',
          },
        ],
      });
    });

    it('handles @types specially (reversed)', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: null,
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          labels: ['a', 'c'],
          group: {},
        },
        {
          commitBodyTable: true,
          datasource: NpmDatasource.id,
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: null,
          branchName: 'some-branch',
          prTitle: 'some-other-title',
          newValue: '1.0.0',
          labels: ['a', 'b'],
          group: {},
        },
        {
          manager: 'some-manager',
          depName: '@types/some-dep',
          groupName: null,
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.5.7',
          labels: ['a'],
          group: {},
        },
      ];
      expect(generateBranchConfig(branch)).toMatchSnapshot({
        upgrades: [
          {
            manager: 'some-manager',
            depName: 'some-dep',
            branchName: 'some-branch',
            newValue: '0.6.0',
            labels: ['a', 'c'],
          },
          {
            manager: 'some-manager',
            depName: 'some-dep',
            branchName: 'some-branch',
            newValue: '1.0.0',
            labels: ['a', 'b'],
          },
          {
            depName: '@types/some-dep',
            branchName: 'some-branch',
            newValue: '0.5.7',
            labels: ['a'],
          },
        ],
      });
    });

    it('handles upgrades', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
          depName: 'some-dep',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          hasBaseBranches: true,
          fileReplacePosition: 5,
        },
        {
          ...defaultConfig,
          manager: 'some-manager',
          depName: 'some-dep',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          isGroup: true,
          separateMinorPatch: true,
          updateType: 'minor' as UpdateType,
          fileReplacePosition: 1,
        },
        {
          ...defaultConfig,
          manager: 'some-manager',
          depName: 'some-dep',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          isGroup: true,
          separateMajorMinor: true,
          updateType: 'major' as UpdateType,
          fileReplacePosition: 2,
        },
        {
          ...defaultConfig,
          manager: 'some-manager',
          depName: 'some-dep',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          isGroup: true,
          separateMajorMinor: true,
          separateMinorPatch: true,
          updateType: 'patch' as UpdateType,
          fileReplacePosition: 0,
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.prTitle).toMatchSnapshot('some-title (patch)');
    });

    it('combines prBodyColumns', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
          branchName: 'some-branch',
          prBodyColumns: ['column-a', 'column-b'],
        },
        {
          manager: 'some-manager',
          branchName: 'some-branch',
          prBodyColumns: ['column-c', 'column-b', 'column-a'],
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.prBodyColumns).toEqual(['column-a', 'column-b', 'column-c']);
    });

    it('sorts upgrades, without position first', () => {
      const branch: BranchUpgradeConfig[] = [
        {
          manager: 'some-manager',
          depName: 'some-dep1',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          fileReplacePosition: 1,
        },
        {
          manager: 'some-manager',
          depName: 'some-dep2',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          fileReplacePosition: undefined,
        },
        {
          manager: 'some-manager',
          depName: 'some-dep3',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          fileReplacePosition: 4,
        },
        {
          manager: 'some-manager',
          depName: 'some-dep4',
          branchName: 'some-branch',
          prTitle: 'some-title',
          newValue: '0.6.0',
          fileReplacePosition: undefined,
        },
      ];
      const res = generateBranchConfig(branch);
      expect(
        res.upgrades.map((upgrade) => upgrade.fileReplacePosition)
      ).toStrictEqual([undefined, undefined, 4, 1]);
    });

    it('passes through pendingChecks', () => {
      const branch = [
        {
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          pendingChecks: true,
        },
        {
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          pendingChecks: true,
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.pendingChecks).toBeTrue();
      expect(res.upgrades).toHaveLength(2);
    });

    it('filters pendingChecks', () => {
      const branch = [
        {
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
          pendingChecks: true,
        },
        {
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'some-title',
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.pendingChecks).toBeUndefined();
      expect(res.upgrades).toHaveLength(1);
    });

    it('displays pending versions', () => {
      const branch = [
        {
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'No pending version',
        },
        {
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'One pending version',
          pendingVersions: ['1.1.0'],
        },
        {
          manager: 'some-manager',
          depName: 'some-dep',
          groupName: 'some-group',
          branchName: 'some-branch',
          prTitle: 'Two pending versions',
          pendingVersions: ['1.1.0', '1.1.1'],
        },
      ];
      const res = generateBranchConfig(branch);
      expect(res.upgrades.map((u) => u.displayPending)).toStrictEqual([
        '',
        '`1.1.0`',
        '`1.1.1` (+1)',
      ]);
    });
  });
});
