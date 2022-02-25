
export function dryable(featureFlag: boolean, returnValue: any): any {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      if (featureFlag) {
        descriptor.value = function () {
            return returnValue;
        }
      }
      return descriptor;
  }
}