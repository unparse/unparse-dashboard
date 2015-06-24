Parse.serverURL = '/api';
Parse.initialize('519e32bde6ce6398dedd6217ed3aea09b086ab6d', '47a980ec12488c672775f64803c68f2e1cc77182');

// Parse lib fix: allow any permission name
var oldACL = Parse.ACL;
Parse.ACL = function (arg1) {
	if (arg1 && typeof arg1 == 'object' && !(arg1 instanceof Parse.User)) {
		oldACL.call(this);
		this.permissionsById = arg1;
	} else {
		oldACL.call(this, arg1);
	}
};
Parse.ACL.prototype = oldACL.prototype;

var Class = Parse.Object.extend('__Class');


var app = angular.module('unparse', ['ui.bootstrap']);

// Handle <template> elements as Angular templates
// For a better readability (no <script> hack!)
app.directive('template', ['$templateCache', function ($templateCache) {
	return {
		restrict: 'E',
		link: function(scope, element, attrs) {
			$templateCache.put(element.attr('id'), element.html());
			element.remove();
		}
	};
}]);

app.controller('MainCtrl', ['$scope', '$q', '$modal', function ($scope, $q, $modal) {
	$scope.classesList = [];

	$scope.openClass = function (c) {
		$scope.openedClass = c;
	};

	$scope.addClass = function () {
		var modal = $modal.open({
			templateUrl: 'add-class-modal'
		});

		modal.result.then(function (data) {
			var c = new Class({
				name: data.name
			});
			return $q.when(c.save());
		}, function () {}).then(function (c) {
			if (!c) return;

			$scope.classesList.push(c);
		}, function (err) {
			$scope.showError(err);
		});
	};

	$scope.showError = function (msg) {
		if (msg && typeof msg == 'object') {
			msg = msg.message;
		}

		$scope.errorMessage = msg;
	};
}])

app.controller('ClassesListCtrl', ['$scope', '$q', function ($scope, $q) {
	$scope.loadClasses = function () {
		var query = new Parse.Query(Class);
		return $q.when(query.find()).then(function (classes) {
			console.log(classes);
			for (var i = 0; i < classes.length; i++) {
				$scope.classesList.push(classes[i]);
			}
		}, function (err) {
			$scope.showError(err);
		});
	};

	$scope.selectFirstClass = function () {
		return $scope.openClass($scope.classesList[0]);
	};

	$scope.loadClasses().then(function () {
		return $scope.selectFirstClass();
	});
}]);

app.controller('OpenedClassCtrl', ['$scope', '$q', '$modal', function ($scope, $q, $modal) {
	$scope.activeRow = null;
	$scope.openedRows = [];

	$scope.$watch('openedClass', function (c) {
		if (!c) return;

		$scope.addingNewRow = false;
		$scope.activeRow = null;
		$scope.openedRows = [];

		var query = new Parse.Query(c.get('name'));
		return $q.when(query.find()).then(function (rows) {
			$scope.openedRows = rows;
		});
	});

	$scope.selectRow = function (row) {
		$scope.activeRow = row;
	};

	$scope.addColumn = function () {
		var modal = $modal.open({
			templateUrl: 'add-column-modal'
		});

		modal.result.then(function (data) {
			var c = $scope.openedClass;

			var newColumn = {};
			newColumn[data.name] = { type: data.type };

			var attributes = angular.extend({}, c.get('attributes'), newColumn);
			c.set('attributes', attributes);
			return $q.when(c.save());
		}, function () {}).catch(function (err) {
			$scope.showError(err);
		});
	};

	$scope.addRow = function () {
		$scope.addingNewRow = true;
		$scope.newRowData = {};
	};

	$scope.saveNewRow = function (data) {
		var c = $scope.openedClass;
		var Row = Parse.Object.extend(c.get('name'));

		var row = new Row(data);

		var acl = new Parse.ACL();
		acl.setPublicReadAccess(true);
		acl.setPublicWriteAccess(true);
		row.setACL(acl);

		return $q.when(row.save()).then(function (row) {
			$scope.openedRows.push(row);
			$scope.addingNewRow = false;
		});
	};

	$scope.deleteRow = function (row) {
		if (!row) return;

		var index = $scope.openedRows.indexOf(row);
		$q.when(row.destroy()).then(function () {
			$scope.openedRows.splice(index, 1);
			$scope.activeRow = null;
		}, function (err) {
			$scope.showError(err);
		});
	};

	$scope.rowACLActions = ['read', 'write'];
	$scope.classACLActions = ['read', 'write', 'get', 'find', 'update', 'create', 'delete'];

	$scope.defaultRowACL = {
		'*': { read: true, write: true }
	};
	$scope.defaultClassACL = {
		'*': {
			// ACLs for the class row (in __Class)
			read: true,
			write: true,

			// ACLs for items in the class
			get: true,
			find: true,
			update: true,
			create: true,
			'delete': true
		}
	};

	$scope.changeClassACL = function () {
		var c = $scope.openedClass;
		var acl = c.getACL() || new Parse.ACL();

		var childScope = $scope.$new();
		childScope.actions = $scope.classACLActions;
		childScope.ACL = angular.merge({}, $scope.defaultClassACL, acl.permissionsById);

		var modal = $modal.open({
			templateUrl: 'change-acl-modal',
			scope: childScope
		});

		modal.result.then(function (data) {
			acl.permissionsById = data;
			c.setACL(acl);
			return $q.when(c.save());
		}, function () {}).catch(function (err) {
			$scope.showError(err);
		});
	};

	$scope.changeRowACL = function (row) {
		var row = $scope.activeRow;
		var acl = row.getACL() || new Parse.ACL();

		var childScope = $scope.$new();
		childScope.actions = $scope.rowACLActions;
		childScope.ACL = angular.merge({}, $scope.defaultRowACL, acl.permissionsById);

		var modal = $modal.open({
			templateUrl: 'change-acl-modal',
			scope: childScope
		});

		modal.result.then(function (data) {
			var acl = new Parse.ACL(data);
			row.setACL(acl);
			return $q.when(row.save());
		}, function () {}).catch(function (err) {
			$scope.showError(err);
		});
	};
}]);